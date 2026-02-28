# Agentic Kit

A unified, streaming-capable interface for multiple LLM providers. Plug in any supported adapter and swap between them at runtime.

## Installation

```bash
npm install agentic-kit
```

## Quick Start

```typescript
import { createOllamaKit, createMultiProviderKit, OllamaAdapter, AgentKit } from 'agentic-kit';

// Ollama
const kit = createOllamaKit('http://localhost:11434');
const text = await kit.generate({ model: 'mistral', prompt: 'Hello' });

// Multi-provider with fallback
const multi = createMultiProviderKit();
multi.addProvider(new OllamaAdapter('http://localhost:11434'));
const reply = await multi.generate({ model: 'mistral', prompt: 'Hello' });
```

## Streaming

```typescript
await kit.generate(
  { model: 'mistral', prompt: 'Hello', stream: true },
  { onChunk: (chunk) => process.stdout.write(chunk) }
);
```

## API Reference

### `AgentKit`

- `.generate(input: GenerateInput, options?: StreamingOptions): Promise<string | void>`
- `.addProvider(provider: AgentProvider): void`
- `.setProvider(name: string): void`
- `.listProviders(): string[]`
- `.getCurrentProvider(): AgentProvider | undefined`

### `GenerateInput`

```ts
interface GenerateInput {
  model: string;
  prompt: string;
  stream?: boolean;
}
```

### `StreamingOptions`

```ts
interface StreamingOptions {
  onChunk?: (chunk: string) => void;
  onStateChange?: (state: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}
```
