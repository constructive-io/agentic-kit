# Ollama Client

A JavaScript/TypeScript client for the Ollama LLM server, supporting model listing, text generation, streaming responses, embeddings, and model management.

## Installation

```bash
npm install @agentic-kit/ollama
# or
yarn add @agentic-kit/ollama
```

## Usage

```typescript
import OllamaClient, { GenerateInput } from '@agentic-kit/ollama';

// Create a client (default port 11434)
const client = new OllamaClient('http://localhost:11434');

// List available models
const models = await client.listModels();
console.log('Available models:', models);

// Non-streaming text generation
const output = await client.generate({ model: 'mistral', prompt: 'Hello, Ollama!' });
console.log(output);

// Streaming generation
await client.generate(
  { model: 'mistral', prompt: 'Hello, streaming!', stream: true },
  (chunk) => {
    console.log('Received chunk:', chunk);
  }
);

// Pull a model to local cache
await client.pullModel('mistral');

// Generate embeddings
const embedding = await client.generateEmbedding('Compute embeddings');
console.log('Embedding vector length:', embedding.length);

// Generate a conversational response with context
const response = await client.generateResponse(
  'What is the capital of France?',
  'Geography trivia'
);
console.log(response);

// Delete a pulled model when done
await client.deleteModel('mistral');
```

## API Reference

- `new OllamaClient(baseUrl?: string)` – defaults to `http://localhost:11434`
- `.listModels(): Promise<string[]>`
- `.generate(input: GenerateInput, onChunk?: (chunk: string) => void): Promise<string | void>`
- `.generateStreamingResponse(prompt: string, onChunk: (chunk: string) => void, context?: string): Promise<void>`
- `.generateEmbedding(text: string): Promise<number[]>`
- `.generateResponse(prompt: string, context?: string): Promise<string>`
- `.pullModel(model: string): Promise<void>`
- `.deleteModel(model: string): Promise<void>`

## GenerateInput type

```ts
interface GenerateInput {
  model: string;
  prompt: string;
  stream?: boolean;
}
```

## Contributing

Please open issues or pull requests on [GitHub](https://github.com/hyperweb-io/agentic-kit).

---

© Hyperweb (formerly Cosmology). See LICENSE for full licensing and disclaimer. 