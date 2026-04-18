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

A provider-portable LLM toolkit with structured streaming, model registries,
cross-provider message normalization, and an optional stateful agent runtime.

## Packages

- **agentic-kit** — low-level portability layer with model descriptors, registries, structured event streams, and compatibility helpers
- **@agentic-kit/agent** — minimal stateful runtime with sequential tool execution and lifecycle events
- **@agentic-kit/ollama** — adapter for local Ollama inference
- **@agentic-kit/anthropic** — adapter for Anthropic Claude models
- **@agentic-kit/openai** — generalized adapter for OpenAI-compatible chat completion APIs

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
import { complete, getModel } from 'agentic-kit';

const model = getModel('openai', 'gpt-4o-mini');
const message = await complete(model!, {
  messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
});

console.log(message.content);
```

## Contributing

See individual package READMEs for docs and local dev instructions.
