# agentic-kit

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/agentic-kit/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/agentic-kit/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/agentic-kit/blob/main/LICENSE"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
   <a href="https://www.npmjs.com/package/agentic-kit"><img height="20" src="https://img.shields.io/github/package-json/v/constructive-io/agentic-kit?filename=packages%2Fagentic-kit%2Fpackage.json"/></a>
</p>

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
