import OllamaClient, { ChatMessage, GenerateInput } from '@agentic-kit/ollama';

export type { ChatMessage, GenerateInput };

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface StreamingOptions {
  onChunk?: (chunk: string) => void;
  onStateChange?: (state: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export interface AgentProvider {
  readonly name: string;
  generate(input: GenerateInput): Promise<string>;
  generateStreaming(input: GenerateInput, onChunk: (chunk: string) => void): Promise<void>;
  listModels?(): Promise<string[]>;
}

// ─── Ollama Adapter ───────────────────────────────────────────────────────────

export class OllamaAdapter implements AgentProvider {
  public readonly name = 'ollama';
  private client: OllamaClient;

  constructor(baseUrl?: string) {
    this.client = new OllamaClient(baseUrl);
  }

  async generate(input: GenerateInput): Promise<string> {
    return this.client.generate(input) as Promise<string>;
  }

  async generateStreaming(input: GenerateInput, onChunk: (chunk: string) => void): Promise<void> {
    return this.client.generate(input, onChunk);
  }

  async listModels(): Promise<string[]> {
    return this.client.listModels();
  }
}

// ─── AgentKit ─────────────────────────────────────────────────────────────────

export class AgentKit {
  private providers = new Map<string, AgentProvider>();
  private current?: AgentProvider;

  addProvider(provider: AgentProvider): this {
    this.providers.set(provider.name, provider);
    if (!this.current) this.current = provider;
    return this;
  }

  setProvider(name: string): this {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider '${name}' not found`);
    this.current = provider;
    return this;
  }

  getCurrentProvider(): AgentProvider | undefined {
    return this.current;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async generate(input: GenerateInput, options?: StreamingOptions): Promise<string | void> {
    if (!this.current) throw new Error('No provider set. Call addProvider() first.');

    if (options?.onChunk) {
      try {
        await this.current.generateStreaming(input, options.onChunk);
        options.onComplete?.();
      } catch (err) {
        options.onError?.(err as Error);
        throw err;
      }
      return;
    }

    try {
      const result = await this.current.generate(input);
      options?.onComplete?.();
      return result;
    } catch (err) {
      options?.onError?.(err as Error);
      throw err;
    }
  }

  async listModels(): Promise<string[]> {
    return this.current?.listModels?.() ?? [];
  }
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

export function createOllamaKit(baseUrl?: string): AgentKit {
  return new AgentKit().addProvider(new OllamaAdapter(baseUrl));
}

export function createMultiProviderKit(): AgentKit {
  return new AgentKit();
}
