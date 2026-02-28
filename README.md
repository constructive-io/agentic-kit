# Agentic Kit Monorepo

A unified, streaming-capable interface for multiple LLM providers.

## Packages

- **agentic-kit** — core library with provider abstraction and `AgentKit` manager
- **@agentic-kit/ollama** — adapter for local Ollama inference

## Getting Started

```bash
git clone git@github.com:pyramation-studio/agentic-kit.git
cd agentic-kit
yarn install
yarn build
yarn test
```

## Usage

```typescript
import { createOllamaKit, createMultiProviderKit, OllamaAdapter } from 'agentic-kit';

const kit = createOllamaKit('http://localhost:11434');
const text = await kit.generate({ model: 'mistral', prompt: 'Hello' });

// Multi-provider
const multi = createMultiProviderKit();
multi.addProvider(new OllamaAdapter('http://localhost:11434'));
```

## Contributing

See individual package READMEs for docs and local dev instructions.
