import fetch from 'cross-fetch';
import { AnthropicAdapter } from '../src';

const apiKey = 'sk-ant-test';

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;

  beforeEach(() => {
    adapter = new AnthropicAdapter(apiKey);
    jest.clearAllMocks();
  });

  afterEach(() => { jest.resetAllMocks(); });

  // ── Constructor ─────────────────────────────────────────────────────────────

  it('accepts a plain string as apiKey', () => {
    expect(new AnthropicAdapter('key').name).toBe('anthropic');
  });

  it('accepts an options object', () => {
    expect(new AnthropicAdapter({ apiKey: 'key', defaultModel: 'claude-haiku-4-5' }).name).toBe('anthropic');
  });

  // ── listModels ──────────────────────────────────────────────────────────────

  it('listModels returns Claude model names', async () => {
    const models = await adapter.listModels();
    expect(models).toContain('claude-opus-4-5');
    expect(models).toContain('claude-sonnet-4-5');
  });

  // ── generate ────────────────────────────────────────────────────────────────

  it('generate returns content text', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => msgResponse('Hello from Claude'),
    });
    expect(await adapter.generate({ model: 'claude-opus-4-5', prompt: 'Hi' })).toBe('Hello from Claude');
  });

  it('generate sends correct headers', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => msgResponse('ok') });
    await adapter.generate({ model: 'claude-opus-4-5', prompt: 'hi' });
    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/v1/messages');
    expect(opts.headers['x-api-key']).toBe(apiKey);
    expect(opts.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('generate uses defaultModel when model is empty', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => msgResponse('ok') });
    const a = new AnthropicAdapter({ apiKey, defaultModel: 'claude-haiku-4-5' });
    await a.generate({ model: '', prompt: 'hi' });
    expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).model).toBe('claude-haiku-4-5');
  });

  it('generate places system at top-level body field', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => msgResponse('ok') });
    await adapter.generate({ model: 'claude-opus-4-5', prompt: 'hi', system: 'Be concise.' });
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.system).toBe('Be concise.');
    expect(body.messages.every((m: { role: string }) => m.role !== 'system')).toBe(true);
  });

  it('generate filters system role out of messages[]', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => msgResponse('ok') });
    await adapter.generate({
      model: 'claude-opus-4-5',
      messages: [{ role: 'system', content: 'Be helpful.' }, { role: 'user', content: 'Hello' }],
      system: 'Be helpful.',
    });
    const { messages } = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(messages).toEqual([{ role: 'user', content: 'Hello' }]);
  });

  it('generate passes temperature and maxTokens', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => msgResponse('ok') });
    await adapter.generate({ model: 'claude-opus-4-5', prompt: 'hi', temperature: 0.3, maxTokens: 256 });
    const body = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(256);
  });

  it('generate throws on non-ok response', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });
    await expect(adapter.generate({ model: 'claude-opus-4-5', prompt: 'hi' })).rejects.toThrow('Anthropic error 401');
  });

  // ── generateStreaming ───────────────────────────────────────────────────────

  it('generateStreaming yields text_delta chunks', async () => {
    const sse = sseReader([
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } },
      { type: 'message_stop' },
    ]);
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, body: { getReader: () => sse } });
    const chunks: string[] = [];
    await adapter.generateStreaming({ model: 'claude-opus-4-5', prompt: 'hi' }, (c) => chunks.push(c));
    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('generateStreaming ignores non-delta events', async () => {
    const sse = sseReader([
      { type: 'ping' },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi' } },
      { type: 'message_stop' },
    ]);
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, body: { getReader: () => sse } });
    const chunks: string[] = [];
    await adapter.generateStreaming({ model: 'claude-opus-4-5', prompt: 'hi' }, (c) => chunks.push(c));
    expect(chunks).toEqual(['Hi']);
  });

  // ── proxy baseUrl ───────────────────────────────────────────────────────────

  it('uses custom baseUrl', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => msgResponse('ok') });
    const a = new AnthropicAdapter({ apiKey, baseUrl: 'https://my-proxy.example.com' });
    await a.generate({ model: 'claude-opus-4-5', prompt: 'hi' });
    expect((fetch as jest.Mock).mock.calls[0][0]).toBe('https://my-proxy.example.com/v1/messages');
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msgResponse(text: string) {
  return { content: [{ type: 'text', text }], stop_reason: 'end_turn' };
}

function sseReader(events: object[]) {
  const lines = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
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
