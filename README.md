# Agentic Kit Monorepo

<p align="center" width="100%">
  <img height="250" src="https://raw.githubusercontent.com/constructive-io/constructive/refs/heads/main/assets/outline-logo.svg" />
</p>

<p align="center" width="100%">
  <a href="https://github.com/constructive-io/agentic-kit/actions/workflows/run-tests.yaml">
    <img height="20" src="https://github.com/constructive-io/agentic-kit/actions/workflows/run-tests.yaml/badge.svg" />
  </a>
   <a href="https://github.com/constructive-io/agentic-kit/blob/main/LICENSE"><img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/></a>
</p>

A unified, streaming-capable interface for multiple LLM providers.

## Packages

- **agentic-kit** — core library with provider abstraction and `AgentKit` manager
- **@agentic-kit/ollama** — adapter for local Ollama inference
- **@agentic-kit/anthropic** — adapter for Anthropic Claude models
- **@agentic-kit/openai** — adapter for OpenAI and OpenAI-compatible APIs

## Getting Started

```bash
git clone git@github.com:constructive-io/agentic-kit.git
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
