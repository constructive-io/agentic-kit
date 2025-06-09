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

  it('listModels returns tags', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tags: ['model1', 'model2'] }),
    });
    const models = await client.listModels();
    expect(models).toEqual(['model1', 'model2']);
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags');
  });

  it('generate returns text', async () => {
    const input: GenerateInput = { model: 'model1', prompt: 'hello' };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'response text' }),
    });
    const text = await client.generate(input);
    expect(text).toBe('response text');
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, stream: false }),
    });
  });

  it('pullModel resolves', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await expect(client.pullModel('model1')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'model1' }),
    });
  });

  it('deleteModel resolves', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    await expect(client.deleteModel('model1')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'model1' }),
    });
  });

  it('generateEmbedding returns embedding array', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ embedding: [1, 2, 3] }),
    });
    const embedding = await client.generateEmbedding('test text');
    expect(embedding).toEqual([1, 2, 3]);
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'mistral', prompt: 'test text' }),
    });
  });

  it('generateResponse returns response without context', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'hello response' }),
    });
    const response = await client.generateResponse('hello');
    expect(response).toBe('hello response');
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'mistral', prompt: 'hello', stream: false }),
    });
  });

  it('generateResponse returns response with context', async () => {
    const context = 'ctx';
    const prompt = 'qry';
    const fullPrompt = `Context: ${context}\n\nQuestion: ${prompt}\n\nAnswer:`;
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: 'ctx response' }),
    });
    const response = await client.generateResponse(prompt, context);
    expect(response).toBe('ctx response');
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'mistral', prompt: fullPrompt, stream: false }),
    });
  });

  it('generateStreamingResponse calls onChunk for each chunk', async () => {
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
    const chunks: string[] = [];
    await client.generateStreamingResponse('prompt', (chunk) => chunks.push(chunk));
    expect(chunks).toEqual(['chunk1']);
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'mistral', prompt: 'prompt', stream: true }),
    });
  });

  it('generate with stream parameter calls streaming response', async () => {
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
    
    const chunks: string[] = [];
    const input: GenerateInput = { model: 'model1', prompt: 'hello', stream: true };
    await client.generate(input, (chunk) => chunks.push(chunk));
    expect(chunks).toEqual(['chunk1']);
  });
});
