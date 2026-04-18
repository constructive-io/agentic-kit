import {
  complete,
  createToolResultMessage,
  createUserMessage,
  stream,
  type AssistantMessage,
  type Context,
  type Message,
  type StreamOptions,
} from 'agentic-kit';

import type {
  AgentEvent,
  AgentOptions,
  AgentState,
  AgentTool,
  AgentToolResult,
} from './types.js';
import { validateToolArguments as defaultValidateToolArguments } from './validation.js';

export class Agent {
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly transformContext?: AgentOptions['transformContext'];
  private readonly streamFn: NonNullable<AgentOptions['streamFn']>;
  private readonly validateToolArguments: NonNullable<AgentOptions['validateToolArguments']>;
  private abortController?: AbortController;
  private running?: Promise<void>;

  private _state: AgentState;

  constructor(options: AgentOptions) {
    this._state = {
      systemPrompt: '',
      tools: [],
      messages: [],
      isStreaming: false,
      streamMessage: null,
      streamOptions: undefined,
      ...options.initialState,
    };
    this.streamFn = options.streamFn ?? stream;
    this.transformContext = options.transformContext;
    this.validateToolArguments = options.validateToolArguments ?? defaultValidateToolArguments;
  }

  get state(): AgentState {
    return this._state;
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setModel(model: AgentState['model']): void {
    this._state.model = model;
  }

  setTools(tools: AgentTool[]): void {
    this._state.tools = tools;
  }

  setSystemPrompt(systemPrompt: string): void {
    this._state.systemPrompt = systemPrompt;
  }

  setStreamOptions(streamOptions: Omit<StreamOptions, 'signal'> | undefined): void {
    this._state.streamOptions = streamOptions;
  }

  replaceMessages(messages: Message[]): void {
    this._state.messages = [...messages];
  }

  appendMessage(message: Message): void {
    this._state.messages = [...this._state.messages, message];
  }

  clearMessages(): void {
    this._state.messages = [];
  }

  reset(): void {
    this.abort();
    this._state.messages = [];
    this._state.streamMessage = null;
    this._state.isStreaming = false;
    this._state.error = undefined;
  }

  abort(): void {
    this.abortController?.abort();
  }

  waitForIdle(): Promise<void> {
    return this.running ?? Promise.resolve();
  }

  async prompt(input: string | Message): Promise<void> {
    if (this._state.isStreaming) {
      throw new Error('Agent is already processing a prompt');
    }

    const message = typeof input === 'string' ? createUserMessage(input) : input;
    await this.runLoop([message]);
  }

  async continue(): Promise<void> {
    if (this._state.isStreaming) {
      throw new Error('Agent is already processing');
    }

    const lastMessage = this._state.messages[this._state.messages.length - 1];
    if (!lastMessage) {
      throw new Error('No messages to continue from');
    }
    if (lastMessage.role === 'assistant') {
      throw new Error('Cannot continue from message role: assistant');
    }

    await this.runLoop();
  }

  private async runLoop(initialMessages?: Message[]): Promise<void> {
    this.running = (async () => {
      this.abortController = new AbortController();
      this._state.isStreaming = true;
      this._state.streamMessage = null;
      this._state.error = undefined;

      try {
        this.emit({ type: 'agent_start' });

        if (initialMessages && initialMessages.length > 0) {
          for (const message of initialMessages) {
            this.emit({ type: 'message_start', message });
            this.appendMessage(message);
            this.emit({ type: 'message_end', message });
          }
        }

        while (true) {
          this.emit({ type: 'turn_start' });

          const assistantMessage = await this.generateAssistantMessage(this.abortController.signal);
          this.appendMessage(assistantMessage);
          this.emit({ type: 'message_end', message: assistantMessage });

          if (assistantMessage.stopReason === 'error' || assistantMessage.stopReason === 'aborted') {
            this._state.error = assistantMessage.errorMessage;
            this.emit({ type: 'turn_end', message: assistantMessage, toolResults: [] });
            break;
          }

          const toolCalls = assistantMessage.content.filter((block) => block.type === 'toolCall');
          if (toolCalls.length === 0) {
            this.emit({ type: 'turn_end', message: assistantMessage, toolResults: [] });
            break;
          }

          const toolResults = await this.executeToolCalls(toolCalls, this.abortController.signal);
          for (const toolResult of toolResults) {
            this.emit({ type: 'message_start', message: toolResult });
            this.appendMessage(toolResult);
            this.emit({ type: 'message_end', message: toolResult });
          }

          this.emit({ type: 'turn_end', message: assistantMessage, toolResults });
        }

        this.emit({ type: 'agent_end', messages: [...this._state.messages] });
      } finally {
        this._state.isStreaming = false;
        this._state.streamMessage = null;
        this.abortController = undefined;
        this.running = undefined;
      }
    })();

    await this.running;
  }

  private async generateAssistantMessage(signal: AbortSignal): Promise<AssistantMessage> {
    const messages = this.transformContext
      ? await this.transformContext(this._state.messages, signal)
      : this._state.messages;

    const context: Context = {
      systemPrompt: this._state.systemPrompt,
      tools: this._state.tools,
      messages,
    };

    const streamResult = this.streamFn(this._state.model, context, {
      ...(this._state.streamOptions ?? {}),
      signal,
    });

    for await (const event of streamResult) {
      switch (event.type) {
        case 'start':
          this._state.streamMessage = event.partial;
          this.emit({ type: 'message_start', message: event.partial });
          break;
        case 'text_start':
        case 'text_delta':
        case 'text_end':
        case 'thinking_start':
        case 'thinking_delta':
        case 'thinking_end':
        case 'toolcall_start':
        case 'toolcall_delta':
        case 'toolcall_end':
          this._state.streamMessage = event.partial;
          this.emit({
            type: 'message_update',
            message: event.partial,
            assistantMessageEvent: event,
          });
          break;
        case 'done':
        case 'error':
          this._state.streamMessage = null;
          break;
      }
    }

    return streamResult.result();
  }

  private async executeToolCalls(
    toolCalls: Array<Extract<AssistantMessage['content'][number], { type: 'toolCall' }>>,
    signal: AbortSignal
  ) {
    const results = [];

    for (const toolCall of toolCalls) {
      const tool = this._state.tools.find((candidate) => candidate.name === toolCall.name);
      this.emit({
        type: 'tool_execution_start',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        args: toolCall.arguments as Record<string, unknown>,
      });

      let result: AgentToolResult;
      let isError = false;

      try {
        if (!tool) {
          throw new Error(`Tool '${toolCall.name}' not found`);
        }

        const validatedArgs = this.validateToolArguments(
          tool.parameters,
          toolCall.arguments as Record<string, unknown>
        );

        result = await tool.execute(toolCall.id, validatedArgs, signal, (partialResult) => {
          this.emit({
            type: 'tool_execution_update',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            args: validatedArgs,
            partialResult,
          });
        });
      } catch (error) {
        result = {
          content: [
            {
              type: 'text',
              text: error instanceof Error ? error.message : String(error),
            },
          ],
        };
        isError = true;
      }

      this.emit({
        type: 'tool_execution_end',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        result,
        isError,
      });

      results.push(
        createToolResultMessage(toolCall.id, toolCall.name, result.content, isError)
      );
    }

    return results;
  }

  private emit(event: AgentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
