import { z } from 'zod';
import pino from 'pino';

export interface AgentEvent {
  id: string;
  timestamp: Date;
  source: string;
}

export interface Action extends AgentEvent {
  type: 'action';
  actionType: string;
  args: Record<string, any>;
}

export interface Observation extends AgentEvent {
  type: 'observation';
  observationType: string;
  content: string;
  extras?: Record<string, any>;
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
}

export const AgentConfigSchema = z.object({
  name: z.string(),
  maxIterations: z.number().default(100),
  temperature: z.number().min(0).max(2).default(0.7),
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
