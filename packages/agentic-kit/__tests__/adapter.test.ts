import fetch from 'cross-fetch';

import { AgentKit,OllamaAdapter } from '../src';

describe('AgentKit Adapter Pattern', () => {
  let kit: AgentKit;

  beforeEach(() => {
    kit = new AgentKit();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should add and switch between providers', () => {
    const ollamaAdapter = new OllamaAdapter();
    kit.addProvider(ollamaAdapter);
    
    expect(kit.getCurrentProvider()).toBe(ollamaAdapter);
    expect(kit.listProviders()).toEqual(['ollama']);
  });

  it('should generate using current provider', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'response text' }),
    });

    const ollamaAdapter = new OllamaAdapter();
    kit.addProvider(ollamaAdapter);
    
    const result = await kit.generate({ model: 'test', prompt: 'hello' });
    expect(result).toBe('response text');
  });

  it('should handle streaming with adapter', async () => {
    const chunkData = JSON.stringify({ response: 'chunk1' }) + '\n';
    const encoder = new TextEncoder();
    const encoded = encoder.encode(chunkData);
    const mockReader = {
      read: jest.fn()
        .mockResolvedValueOnce({ done: false, value: encoded })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader },
    } as any);

    const ollamaAdapter = new OllamaAdapter();
    kit.addProvider(ollamaAdapter);
    
    const chunks: string[] = [];
    await kit.generate(
      { model: 'test', prompt: 'hello', stream: true },
      { onChunk: (chunk) => chunks.push(chunk) }
    );
    expect(chunks).toEqual(['chunk1']);
  });
});
