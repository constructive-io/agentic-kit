import fetch from 'cross-fetch';
import { TextEncoder } from 'util';

import { AgentKit, OllamaAdapter } from '../src';

describe('AgentKit', () => {
  let kit: AgentKit;

  beforeEach(() => {
    kit = new AgentKit();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ── Provider management ─────────────────────────────────────────────────────

  it('addProvider registers and sets as current', () => {
    const adapter = new OllamaAdapter();
    kit.addProvider(adapter);
    expect(kit.getCurrentProvider()).toBe(adapter);
    expect(kit.listProviders()).toEqual(['ollama']);
  });

  it('addProvider returns this for chaining', () => {
    const adapter = new OllamaAdapter();
    const result = kit.addProvider(adapter);
    expect(result).toBe(kit);
  });

  it('setProvider switches current provider', () => {
    const a = new OllamaAdapter('http://a:11434');
    const b = new OllamaAdapter('http://b:11434');
    // Give b a different name via subclass to test switching
    (b as any).name = 'ollama-b';
    kit.addProvider(a).addProvider(b);
    kit.setProvider('ollama-b');
    expect(kit.getCurrentProvider()).toBe(b);
  });

  it('setProvider throws for unknown provider', () => {
    expect(() => kit.setProvider('unknown')).toThrow("Provider 'unknown' not found");
  });

  it('generate throws when no provider set', async () => {
    await expect(kit.generate({ model: 'llama3', prompt: 'hi' })).rejects.toThrow(
      'No provider set'
    );
  });

  // ── generate (non-streaming) ────────────────────────────────────────────────

  it('generate returns text via current provider', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'hello world', done: true }),
    });

    kit.addProvider(new OllamaAdapter());
    const result = await kit.generate({ model: 'llama3', prompt: 'hi' });
    expect(result).toBe('hello world');
  });

  it('generate calls onComplete callback', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'ok', done: true }),
    });

    const onComplete = jest.fn();
    kit.addProvider(new OllamaAdapter());
    await kit.generate({ model: 'llama3', prompt: 'hi' }, { onComplete });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  // ── generate (streaming) ────────────────────────────────────────────────────

  it('generate streams chunks via onChunk', async () => {
    const chunkData = JSON.stringify({ response: 'chunk1', done: false }) + '\n';
    const encoded = new TextEncoder().encode(chunkData);
    const mockReader = {
      read: jest.fn()
        .mockResolvedValueOnce({ done: false, value: encoded })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader },
    });

    kit.addProvider(new OllamaAdapter());
    const chunks: string[] = [];
    await kit.generate(
      { model: 'llama3', prompt: 'hi', stream: true },
      { onChunk: (c) => chunks.push(c) }
    );
    expect(chunks).toEqual(['chunk1']);
  });

  it('generate calls onError and rethrows on failure', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('network error'));

    const onError = jest.fn();
    kit.addProvider(new OllamaAdapter());
    await expect(
      kit.generate({ model: 'llama3', prompt: 'hi' }, { onError })
    ).rejects.toThrow('network error');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  // ── listModels ──────────────────────────────────────────────────────────────

  it('listModels delegates to current provider', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3' }, { name: 'mistral' }] }),
    });

    kit.addProvider(new OllamaAdapter());
    const models = await kit.listModels();
    expect(models).toEqual(['llama3', 'mistral']);
  });

  it('listModels returns empty array when no provider set', async () => {
    const models = await kit.listModels();
    expect(models).toEqual([]);
  });
});
