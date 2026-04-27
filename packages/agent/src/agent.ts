import { randomUUID } from 'node:crypto';

import {
  type AssistantMessage,
  type Context,
  createToolResultMessage,
  createUserMessage,
  type Message,
  stream,
  type StreamOptions,
  type ToolCallContent,
  type ToolDefinition,
} from 'agentic-kit';

import {
  type AgentRun,
  type AgentRunPending,
  DecisionValidationError,
  MemoryRunStore,
  RunNotFoundError,
  type RunStore,
  ToolNotRegisteredError,
} from './run-store.js';
import type {
  AgentEvent,
  AgentOptions,
  AgentState,
  AgentTool,
  AgentToolResult,
} from './types.js';
import {
  validateSchema,
  validateToolArguments as defaultValidateToolArguments,
} from './validation.js';

export class Agent {
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private readonly transformContext?: AgentOptions['transformContext'];
  private readonly streamFn: NonNullable<AgentOptions['streamFn']>;
  private readonly validateToolArguments: NonNullable<AgentOptions['validateToolArguments']>;
  private readonly runStore: RunStore;
  private readonly generateRunId: () => string;
  private abortController?: AbortController;
  private running?: Promise<void>;
  private currentRunId?: string;
  private pausedRunId?: string;

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
    this.runStore = options.runStore ?? new MemoryRunStore();
    this.generateRunId = options.generateRunId ?? randomUUID;
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
    if (this.pausedRunId) {
      const runId = this.pausedRunId;
      this.pausedRunId = undefined;
      void this.runStore.delete(runId);
      return;
    }
    this.abortController?.abort();
  }

  waitForIdle(): Promise<void> {
    return this.running ?? Promise.resolve();
  }

  async prompt(input: string | Message): Promise<void> {
    if (this._state.isStreaming) {
      throw new Error('Agent is already processing a prompt');
    }
    if (this.pausedRunId) {
      throw new Error('Agent is paused awaiting a decision; call resume() or abort() first');
    }

    const message = typeof input === 'string' ? createUserMessage(input) : input;
    await this.runLoop({ runId: this.generateRunId(), initialMessages: [message] });
  }

  async continue(): Promise<void> {
    if (this._state.isStreaming) {
      throw new Error('Agent is already processing');
    }
    if (this.pausedRunId) {
      throw new Error('Agent is paused awaiting a decision; call resume() or abort() first');
    }

    const lastMessage = this._state.messages[this._state.messages.length - 1];
    if (!lastMessage) {
      throw new Error('No messages to continue from');
    }
    if (lastMessage.role === 'assistant') {
      throw new Error('Cannot continue from message role: assistant');
    }

    await this.runLoop({ runId: this.generateRunId() });
  }

  get pendingRunId(): string | undefined {
    return this.pausedRunId;
  }

  async resume(runId: string, decision: unknown): Promise<void> {
    if (this._state.isStreaming) {
      throw new Error('Agent is already processing');
    }

    const run = await this.runStore.load(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }
    if (!run.pending) {
      throw new Error(`Run ${runId} is not paused`);
    }

    const tool = this._state.tools.find((t) => t.name === run.pending!.toolName);
    if (!tool) {
      throw new ToolNotRegisteredError(runId, run.pending.toolName);
    }
    if (!tool.decision) {
      throw new Error(
        `Tool '${tool.name}' has no decision schema; cannot resume run ${runId}`
      );
    }

    const errors = validateSchema(tool.decision, decision, 'root');
    if (errors.length > 0) {
      throw new DecisionValidationError(runId, tool.name, errors);
    }

    this._state.model = run.model;
    if (run.systemPrompt !== undefined) {
      this._state.systemPrompt = run.systemPrompt;
    }
    this._state.messages = [...run.messages];
    this.pausedRunId = undefined;

    await this.runLoop({
      runId,
      resumeDecision: { toolCallId: run.pending.toolCallId, decision },
    });
  }

  private async runLoop(opts: {
    runId: string;
    initialMessages?: Message[];
    resumeDecision?: { toolCallId: string; decision: unknown };
  }): Promise<void> {
    this.running = (async () => {
      this.abortController = new AbortController();
      this._state.isStreaming = true;
      this._state.streamMessage = null;
      this._state.error = undefined;
      this.currentRunId = opts.runId;

      try {
        this.emit({ type: 'agent_start' });

        if (opts.initialMessages && opts.initialMessages.length > 0) {
          for (const message of opts.initialMessages) {
            this.emit({ type: 'message_start', message });
            this.appendMessage(message);
            this.emit({ type: 'message_end', message });
          }
        }

        let resumeDecision = opts.resumeDecision;

        while (true) {
          let assistantMessage: AssistantMessage;

          if (resumeDecision) {
            const last = this._state.messages[this._state.messages.length - 1];
            if (!last || last.role !== 'assistant') {
              throw new Error('Cannot resume: last message is not an assistant message');
            }
            assistantMessage = last;
          } else {
            this.emit({ type: 'turn_start' });
            assistantMessage = await this.generateAssistantMessage(this.abortController.signal);
            this.appendMessage(assistantMessage);
            this.emit({ type: 'message_end', message: assistantMessage });

            if (assistantMessage.stopReason === 'error' || assistantMessage.stopReason === 'aborted') {
              this._state.error = assistantMessage.errorMessage;
              this.emit({ type: 'turn_end', message: assistantMessage, toolResults: [] });
              break;
            }
          }

          const toolCalls = assistantMessage.content.filter(
            (block): block is ToolCallContent => block.type === 'toolCall'
          );
          if (toolCalls.length === 0) {
            this.emit({ type: 'turn_end', message: assistantMessage, toolResults: [] });
            break;
          }

          const outcome = await this.executeToolCalls(
            toolCalls,
            this.abortController.signal,
            resumeDecision
          );
          resumeDecision = undefined;

          if (outcome.status === 'paused') {
            return;
          }

          this.emit({ type: 'turn_end', message: assistantMessage, toolResults: outcome.results });
        }

        this.emit({ type: 'agent_end', messages: [...this._state.messages] });
        await this.runStore.delete(opts.runId);
      } finally {
        this._state.isStreaming = false;
        this._state.streamMessage = null;
        this.abortController = undefined;
        this.running = undefined;
        this.currentRunId = undefined;
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
    toolCalls: ToolCallContent[],
    signal: AbortSignal,
    resumeDecision?: { toolCallId: string; decision: unknown }
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
      const isResumeTarget = resumeDecision?.toolCallId === toolCall.id;

      if (tool?.decision && !isResumeTarget) {
        let validatedArgs: Record<string, unknown>;
        try {
          validatedArgs = this.validateToolArguments(tool.parameters, args);
        } catch (error) {
          const result: AgentToolResult = {
            content: [
              {
                type: 'text',
                text: error instanceof Error ? error.message : String(error),
              },
            ],
          };
          this.emit({
            type: 'tool_execution_start',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            args,
          });
          this.emit({
            type: 'tool_execution_end',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            result,
            isError: true,
          });
          const toolResult = createToolResultMessage(toolCall.id, toolCall.name, result.content, true);
          this.appendMessageWithEvents(toolResult);
          continue;
        }

        for (const toolResult of results) {
          this.appendMessageWithEvents(toolResult);
        }

        const runId = this.currentRunId!;
        const pending: AgentRunPending = {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          input: validatedArgs,
        };
        const now = Date.now();
        const run: AgentRun = {
          id: runId,
          model: this._state.model,
          systemPrompt: this._state.systemPrompt,
          tools: this._state.tools.map(toToolDefinition),
          messages: [...this._state.messages],
          pending,
          createdAt: now,
          updatedAt: now,
        };
        await this.runStore.save(run);
        this.pausedRunId = runId;
        this.emit({
          type: 'tool_decision_pending',
          runId,
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          input: validatedArgs,
          schema: tool.decision,
        });
        return { status: 'paused' };
      }

      const decisionForExecute = isResumeTarget ? resumeDecision!.decision : undefined;
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
      this.appendMessageWithEvents(toolResult);
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
    this.emit({
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
          this.emit({
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

    this.emit({
      type: 'tool_execution_end',
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      result,
      isError,
    });

    return createToolResultMessage(toolCall.id, toolCall.name, result.content, isError);
  }

  private appendMessageWithEvents(message: Message): void {
    this.emit({ type: 'message_start', message });
    this.appendMessage(message);
    this.emit({ type: 'message_end', message });
  }

  private emit(event: AgentEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

function toToolDefinition(tool: AgentTool): ToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  };
}
