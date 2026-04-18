import {
  createAssistantMessageEventStream,
  type AssistantMessage,
  type Context,
  type ModelDescriptor,
} from 'agentic-kit';

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

  it('turns tool argument validation failures into error tool results and continues', async () => {
    const responses = [
      createAssistantResponse({
        stopReason: 'toolUse',
        content: [{ type: 'toolCall', id: 'tool_1', name: 'echo', arguments: {} }],
      }),
      createAssistantResponse({
        stopReason: 'stop',
        content: [{ type: 'text', text: 'recovered' }],
      }),
    ];

    let callIndex = 0;
    const agent = new Agent({
      initialState: { model: createModel() },
      streamFn: () => streamMessage(responses[callIndex++]),
    });

    const execute = jest.fn(async () => ({
      content: [{ type: 'text' as const, text: 'should not run' }],
    }));

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
        execute,
      },
    ]);

    await agent.prompt('hello');

    expect(execute).not.toHaveBeenCalled();
    expect(agent.state.messages[2]).toMatchObject({
      role: 'toolResult',
      toolName: 'echo',
      isError: true,
    });
    expect(agent.state.messages[2].content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Tool argument validation failed'),
    });
    expect(agent.state.messages[3]).toMatchObject({
      role: 'assistant',
      content: [{ type: 'text', text: 'recovered' }],
    });
  });

  it('records aborted assistant turns when the active stream is cancelled', async () => {
    const agent = new Agent({
      initialState: { model: createModel() },
      streamFn: (_model: ModelDescriptor, _context: Context, options) => {
        const stream = createAssistantMessageEventStream();
        const partial = createAssistantResponse({
          stopReason: 'stop',
          content: [{ type: 'text', text: '' }],
        });

        queueMicrotask(() => {
          stream.push({ type: 'start', partial });

          options?.signal?.addEventListener(
            'abort',
            () => {
              const aborted = createAssistantResponse({
                stopReason: 'aborted',
                errorMessage: 'aborted by test',
                content: [],
              });
              stream.push({ type: 'error', reason: 'aborted', error: aborted });
              stream.end(aborted);
            },
            { once: true }
          );
        });

        return stream;
      },
    });

    const pending = agent.prompt('slow');
    setTimeout(() => agent.abort(), 0);
    await pending;

    expect(agent.state.error).toBe('aborted by test');
    expect(agent.state.messages.at(-1)).toMatchObject({
      role: 'assistant',
      stopReason: 'aborted',
      errorMessage: 'aborted by test',
    });
    expect(agent.state.isStreaming).toBe(false);
    expect(agent.state.streamMessage).toBeNull();
  });
});

function createAssistantResponse(overrides: Partial<AssistantMessage>): AssistantMessage {
  return {
    ...createAssistantResponseBase(),
    ...overrides,
  };
}

function createAssistantResponseBase(): AssistantMessage {
  return {
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
    content: [] as AssistantMessage['content'],
  };
}

function streamMessage(message: AssistantMessage) {
  const stream = createAssistantMessageEventStream();

  queueMicrotask(() => {
    stream.push({ type: 'start', partial: message });
    if (message.content[0]?.type === 'toolCall') {
      stream.push({
        type: 'toolcall_start',
        contentIndex: 0,
        partial: message,
      });
      stream.push({
        type: 'toolcall_end',
        contentIndex: 0,
        toolCall: message.content[0],
        partial: message,
      });
    } else {
      stream.push({
        type: 'text_start',
        contentIndex: 0,
        partial: message,
      });
      stream.push({
        type: 'text_delta',
        contentIndex: 0,
        delta: message.content[0]?.type === 'text' ? message.content[0].text : '',
        partial: message,
      });
      stream.push({
        type: 'text_end',
        contentIndex: 0,
        content: message.content[0]?.type === 'text' ? message.content[0].text : '',
        partial: message,
      });
    }
    stream.push({
      type: 'done',
      reason: message.stopReason === 'toolUse' ? 'toolUse' : 'stop',
      message,
    });
    stream.end(message);
  });

  return stream;
}
