import {
  createUserMessage,
  type Message,
  type StreamOptions,
} from '@agentic-kit/core';
import { stream } from 'agentic-kit';

import { runAgentLoop } from './agent-loop.js';
import type {
  AgentEvent,
  AgentOptions,
  AgentState,
  AgentTool,
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
        await runAgentLoop(
          {
            initialMessages,
            state: {
              ...this._state,
              messages: [...this._state.messages],
              tools: [...this._state.tools],
            },
            streamFn: this.streamFn,
            transformContext: this.transformContext,
            validateToolArguments: this.validateToolArguments,
            signal: this.abortController.signal,
          },
          (event) => this.emit(event)
        );
      } finally {
        this._state.isStreaming = false;
        this._state.streamMessage = null;
        this.abortController = undefined;
        this.running = undefined;
      }
    })();

    await this.running;
  }

  private emit(event: AgentEvent): void {
    switch (event.type) {
    case 'message_start':
    case 'message_update':
      if (event.message.role === 'assistant') {
        this._state.streamMessage = event.message;
      }
      break;
    case 'message_end':
      this._state.messages = [...this._state.messages, event.message];
      if (event.message.role === 'assistant') {
        this._state.streamMessage = null;
      }
      break;
    case 'turn_end':
      if (event.message.stopReason === 'error' || event.message.stopReason === 'aborted') {
        this._state.error = event.message.errorMessage;
      }
      break;
    case 'agent_end':
      this._state.streamMessage = null;
      break;
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
