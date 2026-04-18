import {
  AgentKit,
  createAssistantMessageEventStream,
  getMessageText,
  transformMessages,
  type ModelDescriptor,
  type ProviderAdapter,
} from '../src';

function createFakeModel(): ModelDescriptor {
  return {
    id: 'demo',
    name: 'Demo',
    api: 'fake-api',
    provider: 'fake',
    baseUrl: 'http://fake.local',
    input: ['text'],
    reasoning: false,
    tools: true,
  };
}

describe('agentic-kit core', () => {
  it('transforms cross-provider thinking and inserts orphaned tool results', () => {
    const sourceModel = createFakeModel();
    const targetModel: ModelDescriptor = {
      ...sourceModel,
      provider: 'other',
      api: 'other-api',
      id: 'other-model',
    };

    const messages = transformMessages(
      [
        {
          role: 'assistant',
          api: sourceModel.api,
          provider: sourceModel.provider,
          model: sourceModel.id,
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: 'toolUse',
          timestamp: Date.now(),
          content: [
            { type: 'thinking', thinking: 'private chain' },
            { type: 'toolCall', id: 'call|1', name: 'lookup', arguments: { city: 'Paris' } },
          ],
        },
        { role: 'user', content: 'continue', timestamp: Date.now() },
      ],
      targetModel
    );

    expect(messages[0]).toMatchObject({
      role: 'assistant',
      content: [
        { type: 'text', text: '<thinking>private chain</thinking>' },
        { type: 'toolCall', id: 'call|1', name: 'lookup' },
      ],
    });
    expect(messages[1]).toMatchObject({
      role: 'toolResult',
      toolCallId: 'call|1',
      isError: true,
    });
  });

  it('keeps the legacy AgentKit generate API working through structured streams', async () => {
    const provider: ProviderAdapter & { name: string } = {
      api: 'fake-api',
      provider: 'fake',
      name: 'fake',
      createModel: () => createFakeModel(),
      stream: () => {
        const stream = createAssistantMessageEventStream();
        const message = {
          role: 'assistant' as const,
          api: 'fake-api',
          provider: 'fake',
          model: 'demo',
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: 'stop' as const,
          timestamp: Date.now(),
          content: [{ type: 'text' as const, text: 'hello world' }],
        };

        queueMicrotask(() => {
          stream.push({ type: 'start', partial: { ...message, content: [{ type: 'text', text: '' }] } });
          stream.push({
            type: 'text_start',
            contentIndex: 0,
            partial: { ...message, content: [{ type: 'text', text: '' }] },
          });
          stream.push({
            type: 'text_delta',
            contentIndex: 0,
            delta: 'hello world',
            partial: message,
          });
          stream.push({
            type: 'text_end',
            contentIndex: 0,
            content: 'hello world',
            partial: message,
          });
          stream.push({ type: 'done', reason: 'stop', message });
          stream.end(message);
        });

        return stream;
      },
    };

    const kit = new AgentKit().addProvider(provider);
    const chunks: string[] = [];
    await kit.generate(
      { model: 'demo', prompt: 'hi', stream: true },
      { onChunk: (chunk) => chunks.push(chunk) }
    );

    expect(chunks).toEqual(['hello world']);
    await expect(kit.generate({ model: 'demo', prompt: 'hi' })).resolves.toBe('hello world');
  });
});
