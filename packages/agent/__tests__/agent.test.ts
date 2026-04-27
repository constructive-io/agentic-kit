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

import {
  Agent,
  type AgentEvent,
  type AgentTool,
  DecisionValidationError,
  MemoryRunStore,
  RunNotFoundError,
  ToolNotRegisteredError,
} from '../src';

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
        execute: async (_toolCallId, params, _decision) => ({
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

describe('@agentic-kit/agent — pausable tools', () => {
  function makeApprovalTool(execute: AgentTool['execute']): AgentTool {
    return {
      name: 'approve',
      label: 'Approve',
      description: 'Tool that requires explicit approval',
      parameters: {
        type: 'object',
        properties: { target: { type: 'string' } },
        required: ['target'],
      },
      decision: {
        type: 'object',
        properties: { approved: { type: 'boolean' } },
        required: ['approved'],
      },
      execute,
    };
  }

  function pauseResponse() {
    return makeFakeAssistantMessage({
      stopReason: 'toolUse',
      content: [
        { type: 'toolCall', id: 'tool_1', name: 'approve', arguments: { target: 'thing' } },
      ],
    });
  }

  function finalResponse() {
    return makeFakeAssistantMessage({
      stopReason: 'stop',
      content: [{ type: 'text', text: 'finalized' }],
    });
  }

  it('pauses on a decision-bearing tool, persists the run, and emits tool_decision_pending', async () => {
    const provider = createScriptedProvider({ responses: [pauseResponse()] });
    const runStore = new MemoryRunStore();
    const saveSpy = jest.spyOn(runStore, 'save');
    const execute = jest.fn();
    const events: AgentEvent[] = [];

    const agent = new Agent({
      initialState: { model: makeFakeModel() },
      streamFn: provider.stream,
      runStore,
    });
    agent.subscribe((event) => events.push(event));
    agent.setTools([makeApprovalTool(execute)]);

    await agent.prompt('approve thing');

    expect(execute).not.toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalledTimes(1);

    const pendingEvent = events.find((e) => e.type === 'tool_decision_pending');
    expect(pendingEvent).toMatchObject({
      type: 'tool_decision_pending',
      toolCallId: 'tool_1',
      toolName: 'approve',
      input: { target: 'thing' },
      schema: expect.objectContaining({ type: 'object' }),
    });

    const runId = (pendingEvent as { runId: string }).runId;
    expect(runId).toBeTruthy();
    expect(agent.pendingRunId).toBe(runId);
    expect(agent.state.isStreaming).toBe(false);

    expect(events.some((e) => e.type === 'agent_end')).toBe(false);

    const stored = await runStore.load(runId);
    expect(stored).toMatchObject({
      id: runId,
      pending: { toolCallId: 'tool_1', toolName: 'approve', input: { target: 'thing' } },
    });
    expect(stored?.tools[0]).not.toHaveProperty('execute');
  });

  it('resume invokes execute with the decision argument and continues the loop', async () => {
    const provider = createScriptedProvider({ responses: [pauseResponse(), finalResponse()] });
    const execute = jest.fn(
      async (_id: string, _params: Record<string, unknown>, decision: unknown) => ({
        content: [{ type: 'text' as const, text: `decision=${JSON.stringify(decision)}` }],
      })
    );
    const events: AgentEvent[] = [];

    const agent = new Agent({
      initialState: { model: makeFakeModel() },
      streamFn: provider.stream,
    });
    agent.subscribe((event) => events.push(event));
    agent.setTools([makeApprovalTool(execute)]);

    await agent.prompt('approve thing');
    const runId = agent.pendingRunId!;
    expect(runId).toBeTruthy();

    await agent.resume(runId, { approved: true });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[2]).toEqual({ approved: true });
    expect(agent.pendingRunId).toBeUndefined();

    expect(agent.state.messages.at(-1)).toMatchObject({
      role: 'assistant',
      content: [{ type: 'text', text: 'finalized' }],
    });
    expect(events.some((e) => e.type === 'agent_end')).toBe(true);
  });

  it('rejects a malformed decision and leaves the run resumable', async () => {
    const provider = createScriptedProvider({ responses: [pauseResponse(), finalResponse()] });
    const runStore = new MemoryRunStore();
    const execute = jest.fn(
      async (_id: string, _params: Record<string, unknown>, decision: unknown) => ({
        content: [{ type: 'text' as const, text: `decision=${JSON.stringify(decision)}` }],
      })
    );

    const agent = new Agent({
      initialState: { model: makeFakeModel() },
      streamFn: provider.stream,
      runStore,
    });
    agent.setTools([makeApprovalTool(execute)]);

    await agent.prompt('approve thing');
    const runId = agent.pendingRunId!;

    await expect(agent.resume(runId, { approved: 'yes' })).rejects.toBeInstanceOf(
      DecisionValidationError
    );
    expect(execute).not.toHaveBeenCalled();
    expect(agent.pendingRunId).toBe(runId);
    expect(await runStore.load(runId)).toBeDefined();

    await agent.resume(runId, { approved: true });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(agent.pendingRunId).toBeUndefined();
    expect(await runStore.load(runId)).toBeUndefined();
  });

  it('throws RunNotFoundError when resuming an unknown run', async () => {
    const agent = new Agent({
      initialState: { model: makeFakeModel() },
      streamFn: createScriptedProvider({ responses: [] }).stream,
    });

    await expect(agent.resume('does-not-exist', { approved: true })).rejects.toBeInstanceOf(
      RunNotFoundError
    );
  });

  it('cleans up the persisted run when abort() is called while paused', async () => {
    const provider = createScriptedProvider({ responses: [pauseResponse()] });
    const runStore = new MemoryRunStore();

    const agent = new Agent({
      initialState: { model: makeFakeModel() },
      streamFn: provider.stream,
      runStore,
    });
    agent.setTools([makeApprovalTool(jest.fn())]);

    await agent.prompt('approve thing');
    const runId = agent.pendingRunId!;
    expect(await runStore.load(runId)).toBeDefined();

    agent.abort();
    await new Promise((resolve) => setImmediate(resolve));

    expect(agent.pendingRunId).toBeUndefined();
    expect(await runStore.load(runId)).toBeUndefined();
  });

  it('throws ToolNotRegisteredError when resuming after the tool has been removed', async () => {
    const provider = createScriptedProvider({ responses: [pauseResponse(), finalResponse()] });
    const tool = makeApprovalTool(jest.fn());

    const agent = new Agent({
      initialState: { model: makeFakeModel() },
      streamFn: provider.stream,
    });
    agent.setTools([tool]);

    await agent.prompt('approve thing');
    const runId = agent.pendingRunId!;

    agent.setTools([]);

    await expect(agent.resume(runId, { approved: true })).rejects.toBeInstanceOf(
      ToolNotRegisteredError
    );
  });
});
