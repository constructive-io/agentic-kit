import { z } from 'zod';
import pino from 'pino';
import { EventEmitter } from 'events';

export interface AgentEvent {
  id: string;
  timestamp: Date;
  source: string;
  type: string;
}

export interface Action extends AgentEvent {
  type: 'action';
  actionType: string;
  args: Record<string, any>;
  thought?: string;
}

export interface Observation extends AgentEvent {
  type: 'observation';
  observationType: string;
  content: string;
  extras?: Record<string, any>;
}

export interface CmdRunAction extends Action {
  actionType: 'run';
  args: {
    command: string;
    background?: boolean;
    keepPromptRunning?: boolean;
  };
}

export interface FileReadAction extends Action {
  actionType: 'read';
  args: {
    path: string;
    start?: number;
    end?: number;
  };
}

export interface FileWriteAction extends Action {
  actionType: 'write';
  args: {
    path: string;
    content: string;
    start?: number;
    end?: number;
  };
}

export interface MessageAction extends Action {
  actionType: 'message';
  args: {
    content: string;
    wait_for_response?: boolean;
  };
}

export interface BrowseInteractiveAction extends Action {
  actionType: 'browse_interactive';
  args: {
    browser_id: string;
    url?: string;
    goal: string;
  };
}

export interface CmdOutputObservation extends Observation {
  observationType: 'run';
  content: string;
  command_id: number;
  command: string;
  exit_code: number;
}

export interface FileReadObservation extends Observation {
  observationType: 'read';
  content: string;
  path: string;
}

export interface BrowserOutputObservation extends Observation {
  observationType: 'browse';
  content: string;
  url: string;
  screenshot?: string;
}

export interface ErrorObservation extends Observation {
  observationType: 'error';
  content: string;
  error_code?: string;
}

export interface Agent {
  name: string;
  step(state: AgentState): Promise<Action>;
  reset(): void;
}

export interface AgentState {
  history: AgentEvent[];
  iteration: number;
  maxIterations: number;
  lastAction?: Action;
  lastObservation?: Observation;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
}

export class EventStream extends EventEmitter {
  private events: AgentEvent[] = [];

  emit(eventName: string | symbol, event: AgentEvent): boolean {
    this.events.push(event);
    return super.emit(eventName, event);
  }

  subscribe(callback: (event: AgentEvent) => void): void {
    this.on('event', callback);
  }

  getHistory(): AgentEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}

export class AgentController {
  private agent: Agent;
  private state: AgentState;
  private eventStream: EventStream;

  constructor(agent: Agent, maxIterations: number = 100) {
    this.agent = agent;
    this.eventStream = new EventStream();
    this.state = {
      history: [],
      iteration: 0,
      maxIterations,
      inputs: {},
      outputs: {},
    };
  }

  async step(): Promise<{ action: Action; shouldContinue: boolean }> {
    if (this.state.iteration >= this.state.maxIterations) {
      return { action: null as any, shouldContinue: false };
    }

    const action = await this.agent.step(this.state);
    action.id = `action_${this.state.iteration}_${Date.now()}`;
    action.timestamp = new Date();
    action.source = this.agent.name;

    this.state.history.push(action);
    this.state.lastAction = action;
    this.state.iteration++;

    this.eventStream.emit('event', action);

    return { action, shouldContinue: this.state.iteration < this.state.maxIterations };
  }

  addObservation(observation: Observation): void {
    observation.id = `obs_${this.state.iteration}_${Date.now()}`;
    observation.timestamp = new Date();

    this.state.history.push(observation);
    this.state.lastObservation = observation;

    this.eventStream.emit('event', observation);
  }

  getState(): AgentState {
    return { ...this.state };
  }

  getEventStream(): EventStream {
    return this.eventStream;
  }

  reset(): void {
    this.agent.reset();
    this.state = {
      history: [],
      iteration: 0,
      maxIterations: this.state.maxIterations,
      inputs: {},
      outputs: {},
    };
    this.eventStream.clear();
  }
}

export const AgentConfigSchema = z.object({
  name: z.string(),
  maxIterations: z.number().default(100),
  temperature: z.number().min(0).max(2).default(0.7),
  model: z.string().optional(),
  apiKey: z.string().optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'test' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  })
});

export * from './types';
export * from './events';
export * from './actions';
export * from './observations';

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMProvider {
  readonly name: string;
  generate(prompt: string, options?: LLMOptions): Promise<string>;
  generateStream(prompt: string, onChunk: (chunk: string) => void, options?: LLMOptions): Promise<void>;
}

export interface MemoryStore {
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
  close(): void;
}
