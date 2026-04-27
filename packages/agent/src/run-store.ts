import type { Message, ModelDescriptor, ToolDefinition } from 'agentic-kit';

export interface AgentRunPending {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface AgentRun {
  id: string;
  model: ModelDescriptor;
  systemPrompt?: string;
  tools: ToolDefinition[];
  messages: Message[];
  pending?: AgentRunPending;
  createdAt: number;
  updatedAt: number;
}

export interface RunStore {
  save(run: AgentRun): Promise<void>;
  load(id: string): Promise<AgentRun | undefined>;
  delete(id: string): Promise<void>;
}

export class MemoryRunStore implements RunStore {
  private readonly runs = new Map<string, AgentRun>();

  async save(run: AgentRun): Promise<void> {
    this.runs.set(run.id, cloneRun(run));
  }

  async load(id: string): Promise<AgentRun | undefined> {
    const run = this.runs.get(id);
    return run ? cloneRun(run) : undefined;
  }

  async delete(id: string): Promise<void> {
    this.runs.delete(id);
  }
}

export class RunNotFoundError extends Error {
  readonly runId: string;

  constructor(runId: string) {
    super(`Run not found: ${runId}`);
    this.name = 'RunNotFoundError';
    this.runId = runId;
  }
}

export class DecisionValidationError extends Error {
  readonly runId: string;
  readonly toolName: string;
  readonly errors: string[];

  constructor(runId: string, toolName: string, errors: string[]) {
    super(`Decision validation failed for tool '${toolName}':\n${errors.map((e) => `- ${e}`).join('\n')}`);
    this.name = 'DecisionValidationError';
    this.runId = runId;
    this.toolName = toolName;
    this.errors = errors;
  }
}

export class ToolNotRegisteredError extends Error {
  readonly runId: string;
  readonly toolName: string;

  constructor(runId: string, toolName: string) {
    super(`Tool '${toolName}' is not registered on the agent resuming run ${runId}`);
    this.name = 'ToolNotRegisteredError';
    this.runId = runId;
    this.toolName = toolName;
  }
}

function cloneRun(run: AgentRun): AgentRun {
  return JSON.parse(JSON.stringify(run)) as AgentRun;
}
