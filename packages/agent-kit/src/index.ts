import { Bradie, BradieState } from '@agentic-kit/bradie';
import OllamaClient, { GenerateInput } from '@agentic-kit/ollama';

export interface AgentProvider {
  name: string;
  generate(input: GenerateInput): Promise<string>;
  generateStreaming(input: GenerateInput, onChunk: (chunk: string) => void): Promise<void>;
}

export interface StreamingOptions {
  onChunk?: (chunk: string) => void;
  onStateChange?: (state: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class OllamaAdapter implements AgentProvider {
  public readonly name = 'ollama';
  private client: OllamaClient;

  constructor(baseUrl?: string) {
    this.client = new OllamaClient(baseUrl);
  }

  async generate(input: GenerateInput): Promise<string> {
    return this.client.generate(input);
  }

  async generateStreaming(input: GenerateInput, onChunk: (chunk: string) => void): Promise<void> {
    await this.client.generate({ ...input, stream: true }, onChunk);
  }
}

export class BradieAdapter implements AgentProvider {
  public readonly name = 'bradie';
  private client: Bradie;

  constructor(config: {
    domain: string;
    onSystemMessage: (msg: string) => void;
    onAssistantReply: (msg: string) => void;
    onError?: (err: Error) => void;
    onComplete?: () => void;
  }) {
    this.client = new Bradie(config);
  }

  async generate(input: GenerateInput): Promise<string> {
    const requestId = await this.client.sendMessage(input.prompt);
    return new Promise((resolve, reject) => {
      this.client.subscribeToResponse(requestId)
        .then(() => resolve('Response completed'))
        .catch(reject);
    });
  }

  async generateStreaming(input: GenerateInput, onChunk: (chunk: string) => void): Promise<void> {
    const requestId = await this.client.sendMessage(input.prompt);
    await this.client.subscribeToResponse(requestId);
  }

  getState(): BradieState {
    return this.client.getState();
  }
}

export class AgentKit {
  private providers: Map<string, AgentProvider> = new Map();
  private currentProvider?: AgentProvider;

  addProvider(provider: AgentProvider): void {
    this.providers.set(provider.name, provider);
    if (!this.currentProvider) {
      this.currentProvider = provider;
    }
  }

  setProvider(name: string): void {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider '${name}' not found`);
    }
    this.currentProvider = provider;
  }

  getCurrentProvider(): AgentProvider | undefined {
    return this.currentProvider;
  }

  async generate(input: GenerateInput, options?: StreamingOptions): Promise<string | void> {
    if (!this.currentProvider) {
      throw new Error('No provider set');
    }

    if (input.stream && options?.onChunk) {
      try {
        const result = await this.currentProvider.generateStreaming(input, options.onChunk);
        options?.onComplete?.();
        return result;
      } catch (error) {
        options?.onError?.(error as Error);
        throw error;
      }
    }

    try {
      const result = await this.currentProvider.generate(input);
      options?.onComplete?.();
      return result;
    } catch (error) {
      options?.onError?.(error as Error);
      throw error;
    }
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

export function createOllamaKit(baseUrl?: string): AgentKit {
  const kit = new AgentKit();
  kit.addProvider(new OllamaAdapter(baseUrl));
  return kit;
}

export function createBradieKit(config: {
  domain: string;
  onSystemMessage: (msg: string) => void;
  onAssistantReply: (msg: string) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
}): AgentKit {
  const kit = new AgentKit();
  kit.addProvider(new BradieAdapter(config));
  return kit;
}

export function createMultiProviderKit(): AgentKit {
  return new AgentKit();
}
