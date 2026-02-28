import fetch from 'cross-fetch';
import { TextEncoder } from 'util';

import OllamaClient, { GenerateInput } from '../src';

describe('OllamaClient', () => {
  let client: OllamaClient;

  beforeEach(() => {
    client = new OllamaClient('http://localhost:11434');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ── listModels ──────────────────────────────────────────────────────────────

  it('listModels returns names from models array', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [{ name: 'model1' }, { name: 'model2' }],
      }),
    });
    const models = await client.listModels();
    expect(models).toEqual(['model1', 'model2']);
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
  });

  it('listModels falls back to tags array', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tags: ['model1', 'model2'] }),
    });
    const models = await client.listModels();
    expect(models).toEqual(['model1', 'model2']);
  });

  // ── generate (single-shot, /api/generate) ───────────────────────────────────

  it('generate returns response text', async () => {
    const input: GenerateInput = { model: 'llama3', prompt: 'hello' };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'hi there', done: true }),
    });
    const text = await client.generate(input);
    expect(text).toBe('hi there');
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3', prompt: 'hello', stream: false }),
    });
  });

  it('generate passes system prompt to /api/generate', async () => {
    const input: GenerateInput = { model: 'llama3', prompt: 'hello', system: 'Be concise.' };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'ok', done: true }),
    });
    await client.generate(input);
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.system).toBe('Be concise.');
  });

  it('generate streams via /api/generate', async () => {
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

    const chunks: string[] = [];
    await client.generate({ model: 'llama3', prompt: 'hello', stream: true }, (c) => chunks.push(c));
    expect(chunks).toEqual(['chunk1']);
  });

  // ── generate (multi-turn, /api/chat) ────────────────────────────────────────

  it('generate routes to /api/chat when messages provided', async () => {
    const input: GenerateInput = {
      model: 'llama3',
      messages: [{ role: 'user', content: 'hello' }],
    };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { role: 'assistant', content: 'hi!' },
        done: true,
      }),
    });
    const text = await client.generate(input);
    expect(text).toBe('hi!');
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/chat', expect.any(Object));
  });

  it('generate prepends system message in /api/chat', async () => {
    const input: GenerateInput = {
      model: 'llama3',
      messages: [{ role: 'user', content: 'hello' }],
      system: 'You are helpful.',
    };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { role: 'assistant', content: 'sure' }, done: true }),
    });
    await client.generate(input);
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'You are helpful.' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hello' });
  });

  it('generate streams via /api/chat', async () => {
    const chunkData = JSON.stringify({ message: { content: 'chunk1' }, done: false }) + '\n';
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

    const chunks: string[] = [];
    await client.generate(
      { model: 'llama3', messages: [{ role: 'user', content: 'hi' }] },
      (c) => chunks.push(c)
    );
    expect(chunks).toEqual(['chunk1']);
  });

  // ── pullModel / deleteModel ──────────────────────────────────────────────────

  it('pullModel resolves', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await expect(client.pullModel('llama3')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'llama3' }),
    });
  });

  it('deleteModel resolves', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await expect(client.deleteModel('llama3')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'llama3' }),
    });
  });

  // ── generateEmbedding ───────────────────────────────────────────────────────

  it('generateEmbedding returns embedding with default model', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
    });
    const embedding = await client.generateEmbedding('test text');
    expect(embedding).toEqual([0.1, 0.2, 0.3]);
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.model).toBe('nomic-embed-text');
    expect(body.prompt).toBe('test text');
  });

  it('generateEmbedding accepts custom model', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding: [1, 2, 3] }),
    });
    await client.generateEmbedding('text', 'mxbai-embed-large');
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.model).toBe('mxbai-embed-large');
  });
});
