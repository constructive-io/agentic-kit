import { ANTHROPIC_MODELS, AnthropicAdapter } from '@agentic-kit/anthropic';
import { OLLAMA_MODELS, OllamaAdapter } from '@agentic-kit/ollama';
import { OPENAI_COMPATIBLE_MODELS, OpenAIAdapter } from '@agentic-kit/openai';

import { clearModels, registerModels } from './model-registry.js';
import { clearProviders, registerProvider } from './provider-registry.js';

export function registerBuiltInProviders(): void {
  registerModels([...OPENAI_COMPATIBLE_MODELS, ...ANTHROPIC_MODELS, ...OLLAMA_MODELS]);
  registerProvider(new OpenAIAdapter());
  registerProvider(new AnthropicAdapter({ apiKey: '' }));
  registerProvider(new OllamaAdapter());
}

export function resetBuiltInProviders(): void {
  clearModels();
  clearProviders();
  registerBuiltInProviders();
}
