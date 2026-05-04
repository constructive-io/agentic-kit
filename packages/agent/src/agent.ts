import {
  type AssistantMessage,
  type Context,
  createToolResultMessage,
  createUserMessage,
  type Message,
  stream,
  type StreamOptions,
  type ToolCallContent,
} from 'agentic-kit';

import {
  type AgentRunHandle,
  DefaultAgentRunHandle,
  type RunChannelPush,
} from './run-handle.js';
import type {
  AgentEvent,
  AgentOptions,
  AgentState,
  AgentTool,
  AgentToolResult,
} from './types.js';
import {
  DecisionValidationError,
  validateSchema,
  validateToolArguments as defaultValidateToolArguments,
} from './validation.js';

export class Agent {
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly transformContext?: AgentOptions['transformContext'];
  private readonly streamFn: NonNullable<AgentOptions['streamFn']>;
  private readonly validateToolArguments: NonNullable<AgentOptions['validateToolArguments']>;
  private abortController?: AbortController;
  private running?: Promise<void>;
  private runChannel?: { push: RunChannelPush };

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

  prompt(input: string | Message): AgentRunHandle {
    if (this._state.isStreaming) {
      throw new Error('Agent is already processing a prompt');
    }

    const message = typeof input === 'string' ? createUserMessage(input) : input;

    return new DefaultAgentRunHandle(async (push, signal) =>
      this.runLoop({
        initialMessages: [message],
        externalPush: push ?? undefined,
        externalAbortSignal: signal,
      })
    );
  }

  continue(): AgentRunHandle {
    if (this._state.isStreaming) {
      throw new Error('Agent is already processing');
    }

    const lastMessage = this._state.messages[this._state.messages.length - 1];
    if (!lastMessage) {
      throw new Error('No messages to continue from');
    }

    if (lastMessage.role === 'assistant') {
      const pendingDecisions = this.findPendingDecisions(lastMessage);
      if (pendingDecisions.length === 0) {
        throw new Error(
          'Cannot continue from trailing assistant message: no tool calls awaiting a decision'
        );
      }
      for (const { tool, decision } of pendingDecisions) {
        const errors = validateSchema(tool.decision!, decision, 'root');
        if (errors.length > 0) {
          throw new DecisionValidationError(tool.name, errors);
        }
      }
    }

    return new DefaultAgentRunHandle(async (push, signal) =>
      this.runLoop({
        externalPush: push ?? undefined,
        externalAbortSignal: signal,
      })
    );
  }

  private findPendingDecisions(
    message: AssistantMessage
  ): Array<{ toolCall: ToolCallContent; tool: AgentTool; decision: unknown }> {
    const completedToolCallIds = new Set(
      this._state.messages
        .filter((m): m is Extract<Message, { role: 'toolResult' }> => m.role === 'toolResult')
        .map((m) => m.toolCallId)
    );

    const pending: Array<{ toolCall: ToolCallContent; tool: AgentTool; decision: unknown }> = [];
    for (const block of message.content) {
      if (block.type !== 'toolCall') {
        continue;
      }
      if (completedToolCallIds.has(block.id)) {
        continue;
      }
      if (!('decision' in block) || block.decision === undefined) {
        continue;
      }
      const tool = this._state.tools.find((t) => t.name === block.name);
      if (!tool || !tool.decision) {
        continue;
      }
      pending.push({ toolCall: block, tool, decision: block.decision });
    }
    return pending;
  }

  private async runLoop(opts: {
    initialMessages?: Message[];
    externalPush?: RunChannelPush;
    externalAbortSignal?: AbortSignal;
  }): Promise<void> {
    this.running = (async () => {
      this.abortController = new AbortController();
      const localAbortController = this.abortController;
      this._state.isStreaming = true;
      this._state.streamMessage = null;
      this._state.error = undefined;
      if (opts.externalPush) {
        this.runChannel = { push: opts.externalPush };
      }

      const onExternalAbort = () => localAbortController.abort();
      if (opts.externalAbortSignal) {
        if (opts.externalAbortSignal.aborted) {
          localAbortController.abort();
        } else {
          opts.externalAbortSignal.addEventListener('abort', onExternalAbort, { once: true });
        }
      }

      try {
        await this.emit({ type: 'agent_start' });

        if (opts.initialMessages && opts.initialMessages.length > 0) {
          for (const message of opts.initialMessages) {
            await this.emit({ type: 'message_start', message });
            this.appendMessage(message);
            await this.emit({ type: 'message_end', message });
          }
        }

        let resumingFromTrailingAssistant =
          this._state.messages[this._state.messages.length - 1]?.role === 'assistant';

        while (true) {
          let assistantMessage: AssistantMessage;

          if (resumingFromTrailingAssistant) {
            const last = this._state.messages[this._state.messages.length - 1];
            if (!last || last.role !== 'assistant') {
              throw new Error('Cannot resume: last message is not an assistant message');
            }
            assistantMessage = last;
            resumingFromTrailingAssistant = false;
          } else {
            await this.emit({ type: 'turn_start' });
            assistantMessage = await this.generateAssistantMessage(localAbortController.signal);
            this.appendMessage(assistantMessage);
            await this.emit({ type: 'message_end', message: assistantMessage });

            if (assistantMessage.stopReason === 'error' || assistantMessage.stopReason === 'aborted') {
              this._state.error = assistantMessage.errorMessage;
              await this.emit({ type: 'turn_end', message: assistantMessage, toolResults: [] });
              break;
            }
          }

          const toolCalls = assistantMessage.content.filter(
            (block): block is ToolCallContent => block.type === 'toolCall'
          );
          if (toolCalls.length === 0) {
            await this.emit({ type: 'turn_end', message: assistantMessage, toolResults: [] });
            break;
          }

          const outcome = await this.executeToolCalls(toolCalls, localAbortController.signal);

          if (outcome.status === 'paused') {
            return;
          }

          await this.emit({ type: 'turn_end', message: assistantMessage, toolResults: outcome.results });
        }

        await this.emit({ type: 'agent_end', messages: [...this._state.messages] });
      } finally {
        if (opts.externalAbortSignal) {
          opts.externalAbortSignal.removeEventListener('abort', onExternalAbort);
        }
        this._state.isStreaming = false;
        this._state.streamMessage = null;
        this.abortController = undefined;
        this.running = undefined;
        this.runChannel = undefined;
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
        await this.emit({ type: 'message_start', message: event.partial });
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
        await this.emit({
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
    toolCalls: ToolCallContent[],
    signal: AbortSignal
  ): Promise<
    | { status: 'completed'; results: ReturnType<typeof createToolResultMessage>[] }
    | { status: 'paused' }
  > {
    const completedToolCallIds = new Set(
      this._state.messages
        .filter((m): m is Extract<Message, { role: 'toolResult' }> => m.role === 'toolResult')
        .map((m) => m.toolCallId)
    );

    const results: ReturnType<typeof createToolResultMessage>[] = [];

    for (const toolCall of toolCalls) {
      if (completedToolCallIds.has(toolCall.id)) {
        continue;
      }

      const tool = this._state.tools.find((candidate) => candidate.name === toolCall.name);
      const args = toolCall.arguments as Record<string, unknown>;
      const decisionAttached = 'decision' in toolCall && toolCall.decision !== undefined;

      if (tool?.decision && !decisionAttached) {
        let validatedArgs: Record<string, unknown>;
        try {
          validatedArgs = this.validateToolArguments(tool.parameters, args);
        } catch (error) {
          for (const prior of results) {
            await this.appendMessageWithEvents(prior);
          }
          results.length = 0;

          const result: AgentToolResult = {
            content: [
              {
                type: 'text',
                text: error instanceof Error ? error.message : String(error),
              },
            ],
          };
          await this.emit({
            type: 'tool_execution_start',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            args,
          });
          await this.emit({
            type: 'tool_execution_end',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            result,
            isError: true,
          });
          const toolResult = createToolResultMessage(toolCall.id, toolCall.name, result.content, true);
          await this.appendMessageWithEvents(toolResult);
          continue;
        }

        for (const toolResult of results) {
          await this.appendMessageWithEvents(toolResult);
        }

        await this.emit({
          type: 'tool_decision_pending',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          input: validatedArgs,
          schema: tool.decision,
        });
        return { status: 'paused' };
      }

      const decisionForExecute = decisionAttached ? toolCall.decision : undefined;
      const toolResult = await this.executeOneTool(
        tool,
        toolCall,
        args,
        decisionForExecute,
        signal
      );
      results.push(toolResult);
    }

    for (const toolResult of results) {
      await this.appendMessageWithEvents(toolResult);
    }

    return { status: 'completed', results };
  }

  private async executeOneTool(
    tool: AgentTool | undefined,
    toolCall: ToolCallContent,
    args: Record<string, unknown>,
    decision: unknown,
    signal: AbortSignal
  ): Promise<ReturnType<typeof createToolResultMessage>> {
    await this.emit({
      type: 'tool_execution_start',
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      args,
    });

    let result: AgentToolResult;
    let isError = false;

    try {
      if (!tool) {
        throw new Error(`Tool '${toolCall.name}' not found`);
      }

      const validatedArgs = this.validateToolArguments(tool.parameters, args);

      result = await tool.execute(
        toolCall.id,
        validatedArgs,
        decision,
        signal,
        (partialResult) => {
          void this.emit({
            type: 'tool_execution_update',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            args: validatedArgs,
            partialResult,
          });
        }
      );
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

    await this.emit({
      type: 'tool_execution_end',
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      result,
      isError,
    });

    return createToolResultMessage(toolCall.id, toolCall.name, result.content, isError);
  }

  private async appendMessageWithEvents(message: Message): Promise<void> {
    await this.emit({ type: 'message_start', message });
    this.appendMessage(message);
    await this.emit({ type: 'message_end', message });
  }

  private async emit(event: AgentEvent): Promise<void> {
    for (const listener of this.listeners) {
      listener(event);
    }
    if (this.runChannel) {
      await this.runChannel.push(event);
    }
  }
}
