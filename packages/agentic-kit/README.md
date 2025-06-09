# Agentic Kit

Agentic Kit is the core library providing a unified, streaming-capable interface for multiple LLM providers. It lets you plug in any supported adapter and switch between them at runtime.

## Installation

```bash
npm install agentic-kit
# or
yarn add agentic-kit
```

Agentic Kit includes adapters for Ollama and Bradie out of the box.

## Quick Start

```typescript
import {
  // Adapters
  OllamaAdapter,
  BradieAdapter,

  // Factory functions
  createOllamaKit,
  createBradieKit,
  createMultiProviderKit,

  // Core type
  AgentKit
} from 'agentic-kit';

// Ollama-only client
const ollamaKit: AgentKit = createOllamaKit('http://localhost:11434');
const text = await ollamaKit.generate({ model: 'mistral', prompt: 'Hello' });
console.log(text);

// Bradie-only client
const bradieKit: AgentKit = createBradieKit({
  domain: 'http://localhost:3000',
  onSystemMessage: (msg) => console.log('[system]', msg),
  onAssistantReply: (msg) => console.log('[assistant]', msg),
});
await bradieKit.generate({ prompt: 'Hello' });

// Multi-provider client
const multiKit = createMultiProviderKit();
multiKit.addProvider(new OllamaAdapter('http://localhost:11434'));
multiKit.addProvider(new BradieAdapter({
  domain: 'http://localhost:3000',
  onSystemMessage: console.log,
  onAssistantReply: console.log
}));
const reply = await multiKit.generate({ model: 'mistral', prompt: 'Hello' });
console.log(reply);
```

## Streaming

Both adapters support a streaming mode that invokes a callback for each data chunk.

```typescript
await ollamaKit.generate(
  { model: 'mistral', prompt: 'Hello', stream: true },
  (chunk) => console.log('Ollama chunk:', chunk)
);

await bradieKit.generate(
  { model: 'mistral', prompt: 'Hello', stream: true },
  (chunk) => console.log('Bradie chunk:', chunk)
);
```

## API Reference

### AgentKit

- `.generate(input: GenerateInput, options?: StreamingOptions): Promise<string | void>`
- `.listProviders(): string[]`
- `.setProvider(name: string): void`
- `.getCurrentProvider(): AgentProvider | undefined`

### GenerateInput

```ts
interface GenerateInput {
  model?: string;      // For services that support named models
  prompt: string;      // The text prompt
  stream?: boolean;    // If true, use streaming mode
}
```

### StreamingOptions

```ts
interface StreamingOptions {
  onChunk?: (chunk: string) => void;
  onStateChange?: (state: string) => void;
  onError?: (error: Error) => void;
}
```

## Contributing

Contributions are welcome! Please submit issues and pull requests on [GitHub](https://github.com/hyperweb-io/agentic-kit).

---

© Hyperweb (formerly Cosmology). See LICENSE for full licensing and disclaimer. 