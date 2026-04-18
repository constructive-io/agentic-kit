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

A low-level provider portability layer for LLM applications. `agentic-kit`
provides:

- provider-independent `ModelDescriptor` and `Context` types
- structured streaming events for text, reasoning, and tool calls
- model and provider registries
- cross-provider message normalization for replay and handoff
- a one-release compatibility wrapper for the legacy `AgentKit.generate()` API

## Installation

```bash
npm install agentic-kit
```


## Quick Start

### Structured API

```typescript
import { complete, getModel } from 'agentic-kit';

const model = getModel('openai', 'gpt-4o-mini');
const message = await complete(model!, {
  messages: [{ role: 'user', content: 'Hello', timestamp: Date.now() }],
});

console.log(message.content);
```

### Streaming

```typescript
import { stream, getModel } from 'agentic-kit';

const model = getModel('openai', 'gpt-4o-mini');
const result = stream(model!, {
  messages: [{ role: 'user', content: 'Explain tool calling briefly.', timestamp: Date.now() }],
});

for await (const event of result) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.delta);
  }
}
```

## API Reference

### Core API

- `stream(model: ModelDescriptor, context: Context, options?: StreamOptions)`
- `complete(model: ModelDescriptor, context: Context, options?: StreamOptions)`
- `completeText(model: ModelDescriptor, context: Context, options?: StreamOptions)`
- `registerModel(model: ModelDescriptor): void`
- `registerProvider(provider: ProviderAdapter): void`
- `getModel(provider: string, modelId: string): ModelDescriptor | undefined`
- `getModels(provider?: string): ModelDescriptor[]`

### Legacy Compatibility API

`AgentKit` is still available for one transition release:

```ts
interface GenerateInput {
  model: string;
  prompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  stream?: boolean;
}
```

Use `createOpenAIKit`, `createAnthropicKit`, `createOllamaKit`, or
`createMultiProviderKit()` if you still need the old prompt-only entrypoint.
