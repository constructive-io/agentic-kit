import {
  type AssistantMessage,
  clone,
  createAssistantMessage,
  createAssistantMessageEventStream,
  type ModelDescriptor,
  parsePartialJson,
  transformMessages,
} from '../src';

function createModel(overrides: Partial<ModelDescriptor> = {}): ModelDescriptor {
  return {
    id: 'demo',
    name: 'Demo',
    api: 'fake-api',
    provider: 'fake',
    baseUrl: 'http://fake.local',
    input: ['text'],
    reasoning: false,
    tools: true,
    ...overrides,
  };
}

function createMessage(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    ...createAssistantMessage(createModel()),
    content: [{ type: 'text', text: 'hello' }],
    ...overrides,
  };
}

describe('@agentic-kit/core', () => {
  it('resolves stream results from terminal done events', async () => {
    const stream = createAssistantMessageEventStream();
    const message = createMessage();

    queueMicrotask(() => {
      stream.push({ type: 'start', partial: message });
      stream.push({ type: 'done', reason: 'stop', message });
    });

    const eventTypes: string[] = [];
    for await (const event of stream) {
      eventTypes.push(event.type);
    }

    await expect(stream.result()).resolves.toBe(message);
    expect(eventTypes).toEqual(['start', 'done']);
  });

  it('resolves stream results from terminal error events', async () => {
    const stream = createAssistantMessageEventStream();
    const failure = createMessage({
      stopReason: 'error',
      errorMessage: 'failed',
      content: [],
    });

    queueMicrotask(() => {
      stream.push({ type: 'error', reason: 'error', error: failure });
    });

    for await (const _event of stream) {
      // Drain stream.
    }

    await expect(stream.result()).resolves.toBe(failure);
  });

  it('parses incomplete streamed JSON arguments', () => {
    expect(parsePartialJson('{"city":"Paris"}')).toEqual({ city: 'Paris' });
    expect(parsePartialJson('{"city":"Pa')).toEqual({ city: 'Pa' });
    expect(parsePartialJson('')).toEqual({});
    expect(parsePartialJson('  ')).toEqual({});
  });

  it('completes nested streamed JSON arguments', () => {
    expect(parsePartialJson('{"filters":{"city":"Paris","tags":["food"')).toEqual({
      filters: { city: 'Paris', tags: ['food'] },
    });
  });

  it('handles escaped quotes in streamed JSON strings', () => {
    expect(parsePartialJson('{"text":"say \\"he')).toEqual({ text: 'say "he' });
  });

  it('returns an empty object for non-object or malformed JSON arguments', () => {
    expect(parsePartialJson('[{"city":"Paris"}]')).toEqual({});
    expect(parsePartialJson('"Paris"')).toEqual({});
    expect(parsePartialJson('42')).toEqual({});
    expect(parsePartialJson('null')).toEqual({});
    expect(parsePartialJson('{"a":[}')).toEqual({});
  });

  it('clones JSON-shaped values using JSON serialization semantics', () => {
    expect(clone({ city: 'Paris', missing: undefined })).toEqual({ city: 'Paris' });
  });

  it('rewrites stricter-provider tool call ids and matching tool results', () => {
    const transformed = transformMessages(
      [
        createMessage({
          stopReason: 'toolUse',
          content: [
            {
              type: 'toolCall',
              id: 'call|needs-normalizing',
              name: 'lookup',
              arguments: { city: 'Paris' },
            },
          ],
        }),
        {
          role: 'toolResult',
          toolCallId: 'call|needs-normalizing',
          toolName: 'lookup',
          content: [{ type: 'text', text: 'ok' }],
          isError: false,
          timestamp: Date.now(),
        },
      ],
      createModel({ api: 'anthropic-messages', provider: 'anthropic' })
    );

    expect(transformed[0]).toMatchObject({
      role: 'assistant',
      content: [{ type: 'toolCall', id: 'call_needs-normalizing' }],
    });
    expect(transformed[1]).toMatchObject({
      role: 'toolResult',
      toolCallId: 'call_needs-normalizing',
    });
  });
});
