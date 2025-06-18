import { OpenAIProvider, AnthropicProvider, OllamaProvider } from '../src';

describe('AgenticKit LLM', () => {
  it('should create OpenAI provider', () => {
    const provider = new OpenAIProvider('test-key');
    expect(provider.name).toBe('OpenAI');
  });

  it('should create Anthropic provider', () => {
    const provider = new AnthropicProvider('test-key');
    expect(provider.name).toBe('Anthropic');
  });

  it('should create Ollama provider', () => {
    const provider = new OllamaProvider();
    expect(provider.name).toBe('Ollama');
  });
});
