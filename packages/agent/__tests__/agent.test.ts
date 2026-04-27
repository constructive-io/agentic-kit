import {
  type AssistantMessage,
  type Context,
  createAssistantMessageEventStream,
  type ModelDescriptor,
} from 'agentic-kit';
import {
  createScriptedProvider,
  makeFakeAssistantMessage,
  makeFakeModel,
} from '@test/index';

import { Agent } from '../src';

describe('@agentic-kit/agent', () => {
  it('runs a minimal sequential tool loop', async () => {
    const responses = [
      makeFakeAssistantMessage({
        usage: makeUsage(),
        stopReason: 'toolUse',
        content: [
          { type: 'toolCall', id: 'tool_1', name: 'echo', arguments: { text: 'hello' } },
        ],
      }),
      makeFakeAssistantMessage({
        usage: makeUsage(),
        stopReason: 'stop',
        content: [{ type: 'text', text: 'done' }],
      }),
    ];

    const provider = createScriptedProvider({ responses });
    const agent = new Agent({
      initialState: { model: makeFakeModel({ id: 'demo', name: 'Demo' }) },
      streamFn: provider.stream,
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
      makeFakeAssistantMessage({
        stopReason: 'toolUse',
        content: [{ type: 'toolCall', id: 'tool_1', name: 'echo', arguments: {} }],
      }),
      makeFakeAssistantMessage({
        stopReason: 'stop',
        content: [{ type: 'text', text: 'recovered' }],
      }),
    ];

    const provider = createScriptedProvider({ responses });
    const agent = new Agent({
      initialState: { model: makeFakeModel({ id: 'demo', name: 'Demo' }) },
      streamFn: provider.stream,
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
      initialState: { model: makeFakeModel({ id: 'demo', name: 'Demo' }) },
      streamFn: (_model: ModelDescriptor, _context: Context, options) => {
        const stream = createAssistantMessageEventStream();
        const partial = makeFakeAssistantMessage({
          stopReason: 'stop',
          content: [{ type: 'text', text: '' }],
        });

        queueMicrotask(() => {
          stream.push({ type: 'start', partial });

          options?.signal?.addEventListener(
            'abort',
            () => {
              const aborted: AssistantMessage = makeFakeAssistantMessage({
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

function makeUsage() {
  return {
    input: 1,
    output: 1,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 2,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}
