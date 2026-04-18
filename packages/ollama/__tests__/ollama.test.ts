import fetch from 'cross-fetch';
import { TextEncoder } from 'util';

import OllamaClient, { OllamaAdapter } from '../src';

function createLineResponse(lines: string[]) {
  const encoded = new TextEncoder().encode(lines.join('\n'));
  const reader = {
    read: jest
      .fn()
      .mockResolvedValueOnce({ done: false, value: encoded })
      .mockResolvedValueOnce({ done: true, value: undefined }),
  };

  return {
    ok: true,
    body: { getReader: () => reader },
  };
}

describe('OllamaAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('streams assistant text through the structured event API', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(
      createLineResponse([
        JSON.stringify({ message: { content: 'Hello' }, done: false }),
        JSON.stringify({ done: true }),
      ])
    );

    const adapter = new OllamaAdapter('http://localhost:11434');
    const model = adapter.createModel('llama3');
    const stream = adapter.stream(model, {
      messages: [{ role: 'user', content: 'hi', timestamp: Date.now() }],
    });

    const eventTypes: string[] = [];
    for await (const event of stream) {
      eventTypes.push(event.type);
    }

    const message = await stream.result();
    expect(eventTypes).toEqual(expect.arrayContaining(['text_start', 'text_delta', 'text_end', 'done']));
    expect(message.content).toEqual([{ type: 'text', text: 'Hello' }]);
  });

  it('lists models through the client API', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3' }, { name: 'mistral' }] }),
    });

    const client = new OllamaClient('http://localhost:11434');
    await expect(client.listModels()).resolves.toEqual(['llama3', 'mistral']);
  });
});
