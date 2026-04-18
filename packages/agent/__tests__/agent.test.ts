import { createAssistantMessageEventStream, type Context, type ModelDescriptor } from 'agentic-kit';

import { Agent } from '../src';

function createModel(): ModelDescriptor {
  return {
    id: 'demo',
    name: 'Demo',
    api: 'fake',
    provider: 'fake',
    baseUrl: 'http://fake.local',
    input: ['text'],
    reasoning: false,
    tools: true,
  };
}

describe('@agentic-kit/agent', () => {
  it('runs a minimal sequential tool loop', async () => {
    const responses = [
      {
        role: 'assistant' as const,
        api: 'fake',
        provider: 'fake',
        model: 'demo',
        usage: {
          input: 1,
          output: 1,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'toolUse' as const,
        timestamp: Date.now(),
        content: [
          { type: 'toolCall' as const, id: 'tool_1', name: 'echo', arguments: { text: 'hello' } },
        ],
      },
      {
        role: 'assistant' as const,
        api: 'fake',
        provider: 'fake',
        model: 'demo',
        usage: {
          input: 1,
          output: 1,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 2,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'stop' as const,
        timestamp: Date.now(),
        content: [{ type: 'text' as const, text: 'done' }],
      },
    ];

    let callIndex = 0;
    const streamFn = (_model: ModelDescriptor, _context: Context) => {
      const stream = createAssistantMessageEventStream();
      const response = responses[callIndex++];

      queueMicrotask(() => {
        stream.push({ type: 'start', partial: response });
        if (response.content[0].type === 'toolCall') {
          stream.push({
            type: 'toolcall_start',
            contentIndex: 0,
            partial: response,
          });
          stream.push({
            type: 'toolcall_end',
            contentIndex: 0,
            toolCall: response.content[0],
            partial: response,
          });
        } else {
          stream.push({
            type: 'text_start',
            contentIndex: 0,
            partial: response,
          });
          stream.push({
            type: 'text_delta',
            contentIndex: 0,
            delta: 'done',
            partial: response,
          });
          stream.push({
            type: 'text_end',
            contentIndex: 0,
            content: 'done',
            partial: response,
          });
        }
        stream.push({
          type: 'done',
          reason: response.stopReason === 'toolUse' ? 'toolUse' : 'stop',
          message: response,
        });
        stream.end(response);
      });

      return stream;
    };

    const agent = new Agent({
      initialState: {
        model: createModel(),
      },
      streamFn,
    });

    agent.setTools([
      {
        name: 'echo',
        label: 'Echo',
        description: 'Echo text',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
          required: ['text'],
        },
        execute: async (_toolCallId, params) => ({
          content: [{ type: 'text', text: String(params.text) }],
        }),
      },
    ]);

    await agent.prompt('hello');

    expect(agent.state.messages).toHaveLength(4);
    expect(agent.state.messages[1]).toMatchObject({
      role: 'assistant',
      stopReason: 'toolUse',
    });
    expect(agent.state.messages[2]).toMatchObject({
      role: 'toolResult',
      toolName: 'echo',
      content: [{ type: 'text', text: 'hello' }],
    });
    expect(agent.state.messages[3]).toMatchObject({
      role: 'assistant',
      content: [{ type: 'text', text: 'done' }],
    });
  });
});
