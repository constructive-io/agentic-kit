# Agentic Kit Monorepo

This repository contains the Agentic Kit core library and two official adapters for LLM services.

## Packages

- **agentic-kit**: Core library providing a unified, streaming-capable interface for multiple LLM providers.
- **@agentic-kit/ollama**: Adapter for the Ollama LLM server.
- **@agentic-kit/bradie**: Adapter for the Bradie LLM service.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/hyperweb-io/agents.git
cd agents

# Install dependencies
yarn install    # or npm install

# Build all packages
yarn build      # or npm run build

# Run tests
yarn test       # or npm test

# Lint and format
yarn lint       # or npm run lint
```

## Usage Examples

### Core Library (agentic-kit)
```typescript
import {
  createOllamaKit,
  createBradieKit,
  createMultiProviderKit,
  OllamaAdapter,
  BradieAdapter
} from 'agentic-kit';

// Ollama only
const ollamaKit = createOllamaKit('http://localhost:11434');
const ollamaResp = await ollamaKit.generate({ model: 'mistral', prompt: 'Hello' });

// Bradie only
const bradieKit = createBradieKit({
  domain: 'http://localhost:3000',
  onSystemMessage: console.log,
  onAssistantReply: console.log,
});
const bradieResp = await bradieKit.generate({ prompt: 'Hello' });

// Multi-provider
const multiKit = createMultiProviderKit();
multiKit.addProvider(new OllamaAdapter('http://localhost:11434'));
multiKit.addProvider(new BradieAdapter({
  domain: 'http://localhost:3000',
  onSystemMessage: console.log,
  onAssistantReply: console.log
}));
const multiResp = await multiKit.generate({ model: 'mistral', prompt: 'Hello' });
```

### Streaming
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

## Contributing

See individual package READMEs for package-specific docs, advanced configuration, and local development scripts.

---

🛠 Built by Hyperweb (formerly Cosmology). See LICENSE for full license and disclaimer. 