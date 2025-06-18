# @agentic-kit/llm

Language model integrations for AgenticKit - OpenAI, Anthropic, and Ollama providers.

## Installation

```bash
npm install @agentic-kit/llm
```

## Usage

```typescript
import { OpenAIProvider, AnthropicProvider, OllamaProvider } from '@agentic-kit/llm';

// OpenAI
const openai = new OpenAIProvider(process.env.OPENAI_API_KEY);
const response = await openai.generate('Hello, world!');

// Anthropic
const anthropic = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
const response2 = await anthropic.generate('Hello, Claude!');

// Ollama (local)
const ollama = new OllamaProvider('http://localhost:11434');
const response3 = await ollama.generate('Hello, Ollama!');
```

## Available Providers

- `OpenAIProvider` - OpenAI GPT models
- `AnthropicProvider` - Anthropic Claude models
- `OllamaProvider` - Local Ollama models

## API Reference

All providers implement the `LLMProvider` interface from `@agentic-kit/core`.
