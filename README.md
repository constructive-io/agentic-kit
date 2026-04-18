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
pnpm install
pnpm build
pnpm test
```

## Usage

```typescript
import { complete, getModel } from "agentic-kit";

const model = getModel("openai", "gpt-4o-mini");
const message = await complete(model!, {
  messages: [{ role: "user", content: "Hello", timestamp: Date.now() }],
});

console.log(message.content);
```

## Contributing

See individual package READMEs for docs and local dev instructions.

## Testing

Default tests stay deterministic and local:

```bash
pnpm test
```

There is also a local-only Ollama live lane that does not hit hosted
providers. The default root command runs the fast smoke tier:

```bash
OLLAMA_LIVE_MODEL=qwen3.5:4b pnpm test:live:ollama
```

Run the broader lane explicitly when you want slower behavioral coverage:

```bash
OLLAMA_LIVE_MODEL=qwen3.5:4b pnpm test:live:ollama:extended
```

The Ollama live script performs a preflight against `OLLAMA_BASE_URL` and exits
cleanly if the local server or requested model is unavailable. If
`nomic-embed-text:latest` is installed, the lane also exercises local embedding
generation.
