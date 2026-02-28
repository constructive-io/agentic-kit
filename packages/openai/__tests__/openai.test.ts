import fetch from 'cross-fetch';
import { OpenAIAdapter } from '../src';

const apiKey = 'sk-test';

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;

  beforeEach(() => {
    adapter = new OpenAIAdapter(apiKey);
    jest.clearAllMocks();
  });

  afterEach(() => { jest.resetAllMocks(); });

  // ── Constructor ─────────────────────────────────────────────────────────────

  it('accepts a plain string as apiKey', () => {
    expect(new OpenAIAdapter('key').name).toBe('openai');
  });

  it('accepts an options object', () => {
    expect(new OpenAIAdapter({ apiKey: 'key', defaultModel: 'gpt-4o-mini' }).name).toBe('openai');
  });

  // ── listModels ──────────────────────────────────────────────────────────────

  it('listModels returns OpenAI model names', async () => {
    const models = await adapter.listModels();
    expect(models).toContain('gpt-4o');
    expect(models).toContain('o1');
  });

  // ── generate ────────────────────────────────────────────────────────────────

  it('generate returns choice content', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => completionResponse('Hello GPT') });
    expect(await adapter.generate({ model: 'gpt-4o', prompt: 'Hi' })).toBe('Hello GPT');
  });

  it('generate sends Authorization Bearer header', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => completionResponse('ok') });
    await adapter.generate({ model: 'gpt-4o', prompt: 'hi' });
    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/v1/chat/completions');
    expect(opts.headers['Authorization']).toBe(`Bearer ${apiKey}`);
  });

  it('generate uses defaultModel when model is empty', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => completionResponse('ok') });
    const a = new OpenAIAdapter({ apiKey, defaultModel: 'gpt-4o-mini' });
    await a.generate({ model: '', prompt: 'hi' });
    expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).model).toBe('gpt-4o-mini');
  });

  it('generate prepends system as first message', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => completionResponse('ok') });
    await adapter.generate({ model: 'gpt-4o', prompt: 'Hi', system: 'Be concise.' });
    const { messages } = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(messages[0]).toEqual({ role: 'system', content: 'Be concise.' });
    expect(messages[1]).toEqual({ role: 'user', content: 'Hi' });
  });

  it('generate deduplicates system when already in messages[]', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => completionResponse('ok') });
    await adapter.generate({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: 'Be helpful.' }, { role: 'user', content: 'Hello' }],
      system: 'Be helpful.',
    });
    const { messages } = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(messages.filter((m: { role: string }) => m.role === 'system')).toHaveLength(1);
  });

  it('generate passes temperature and maxTokens', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => completionResponse('ok') });
    await adapter.generate({ model: 'gpt-4o', prompt: 'hi', temperature: 0.5, maxTokens: 128 });
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(128);
  });

  it('generate throws on non-ok response', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'Rate limit' });
    await expect(adapter.generate({ model: 'gpt-4o', prompt: 'hi' })).rejects.toThrow('OpenAI error 429');
  });

  // ── generateStreaming ───────────────────────────────────────────────────────

  it('generateStreaming yields delta content', async () => {
    const sse = sseReader([
      { choices: [{ delta: { content: 'Hello' }, finish_reason: null }] },
      { choices: [{ delta: { content: ' world' }, finish_reason: null }] },
      { choices: [{ delta: {}, finish_reason: 'stop' }] },
    ]);
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, body: { getReader: () => sse } });
    const chunks: string[] = [];
    await adapter.generateStreaming({ model: 'gpt-4o', prompt: 'hi' }, (c) => chunks.push(c));
    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('generateStreaming stops at [DONE]', async () => {
    const lines = [
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Hi' }, finish_reason: null }] }),
      'data: [DONE]',
      'data: ' + JSON.stringify({ choices: [{ delta: { content: 'NEVER' }, finish_reason: null }] }),
    ].join('\n') + '\n';
    const encoded = new TextEncoder().encode(lines);
    let done = false;
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => ({ read: jest.fn().mockImplementation(async () => { if (done) return { done: true, value: undefined }; done = true; return { done: false, value: encoded }; }) }) },
    });
    const chunks: string[] = [];
    await adapter.generateStreaming({ model: 'gpt-4o', prompt: 'hi' }, (c) => chunks.push(c));
    expect(chunks).toEqual(['Hi']);
  });

  // ── OpenAI-compatible baseUrl ───────────────────────────────────────────────

  it('uses custom baseUrl for OpenAI-compatible APIs', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => completionResponse('ok') });
    const a = new OpenAIAdapter({ apiKey, baseUrl: 'http://localhost:1234' });
    await a.generate({ model: 'llama3', prompt: 'hi' });
    expect((fetch as jest.Mock).mock.calls[0][0]).toBe('http://localhost:1234/v1/chat/completions');
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function completionResponse(content: string) {
  return {
    choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
  };
}

function sseReader(events: object[]) {
  const lines = [...events.map((e) => `data: ${JSON.stringify(e)}`), 'data: [DONE]'].join('\n') + '\n';
  const encoded = new TextEncoder().encode(lines);
  let done = false;
  return {
    read: jest.fn().mockImplementation(async () => {
      if (done) return { done: true, value: undefined };
      done = true;
      return { done: false, value: encoded };
    }),
  };
}
