export interface LLMProvider {
  name: string;
  generate(prompt: string, options?: LLMOptions): Promise<string>;
  generateStream(prompt: string, onChunk: (chunk: string) => void, options?: LLMOptions): Promise<void>;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface RuntimeEnvironment {
  name: string;
  execute(command: string): Promise<ExecutionResult>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  cleanup(): Promise<void>;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp: Date;
}

export interface MemoryStore {
  save(key: string, data: any): Promise<void>;
  load(key: string): Promise<any>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}
