import type { AgentEvent } from '@agentic-kit/agent';
import { createScriptedSSEResponse, makeFakeAssistantMessage } from '@test/index';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AssistantMessage, Message, UserMessage } from 'agentic-kit';

import { useChat } from '../src';

function streamFromEvents(events: AgentEvent[]): Response {
  return createScriptedSSEResponse(events);
}

function makeUser(content: string, timestamp = 1): UserMessage {
  return { role: 'user', content, timestamp };
}

function makeFinalAssistant(text: string): AssistantMessage {
  return makeFakeAssistantMessage({
    stopReason: 'stop',
    content: [{ type: 'text', text }],
  });
}

function makePartialAssistant(text: string): AssistantMessage {
  return makeFakeAssistantMessage({
    content: [{ type: 'text', text }],
  });
}

function makeAssistantWithToolCall(): AssistantMessage {
  return makeFakeAssistantMessage({
    stopReason: 'toolUse',
    content: [
      {
        type: 'toolCall',
        id: 'call_1',
        name: 'echo',
        arguments: { text: 'hi' },
        rawArguments: '{"text":"hi"}',
      },
    ],
  });
}

describe('useChat', () => {
  it('hydrates messages from initialMessages', () => {
    const initial: Message[] = [makeUser('hi')];
    const { result } = renderHook(() => useChat({ api: '/chat', initialMessages: initial }));
    expect(result.current.messages).toEqual(initial);
  });

  it('sends, streams, and folds messages into the log', async () => {
    const final = makeFinalAssistant('world');
    const userEcho = makeUser('hello');
    const fetchFn = jest.fn(
      async (): Promise<Response> =>
        streamFromEvents([
          { type: 'agent_start' },
          { type: 'message_start', message: userEcho },
          { type: 'message_end', message: userEcho },
          { type: 'message_start', message: makePartialAssistant('') },
          {
            type: 'message_update',
            message: makePartialAssistant('wo'),
            assistantMessageEvent: {
              type: 'text_delta',
              contentIndex: 0,
              delta: 'wo',
              partial: makePartialAssistant('wo'),
            },
          },
          { type: 'message_end', message: final },
          { type: 'agent_end', messages: [userEcho, final] },
        ])
    );
    const onMessage = jest.fn();
    const onFinish = jest.fn();

    const { result } = renderHook(() =>
      useChat({ api: '/chat', fetch: fetchFn, onMessage, onFinish })
    );

    await act(async () => {
      await result.current.send('hello');
    });

    expect(result.current.messages).toMatchObject([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: [{ type: 'text', text: 'world' }] },
    ]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'assistant', content: [{ type: 'text', text: 'world' }] })
    );
  });

  it('forwards body() fields and current messages in the POST body', async () => {
    const final = makeFinalAssistant('ok');
    const fetchFn = jest.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
        streamFromEvents([
          { type: 'agent_start' },
          { type: 'agent_end', messages: [makeUser('hi'), final] },
        ])
    );
    const body = jest.fn(() => ({ model: 'demo', sessionId: 'abc' }));

    const { result } = renderHook(() => useChat({ api: '/chat', fetch: fetchFn, body }));

    await act(async () => {
      await result.current.send('hi');
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(body).toHaveBeenCalledTimes(1);
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    const sent = JSON.parse(init.body as string);
    expect(sent).toMatchObject({
      model: 'demo',
      sessionId: 'abc',
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('drops a malformed SSE event and continues processing valid ones', async () => {
    // parseSSEStream silently ignores malformed JSON, so the hook never sees a
    // bogus event but valid events on either side still flow through.
    const final = makeFinalAssistant('survived');
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"agent_start"}\n\n'));
        controller.enqueue(encoder.encode('data: {garbage not json\n\n'));
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'agent_end', messages: [makeUser('hi'), final] })}\n\n`
          )
        );
        controller.close();
      },
    });
    const response = new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
    const fetchFn = jest.fn(async (): Promise<Response> => response);

    const { result } = renderHook(() => useChat({ api: '/chat', fetch: fetchFn }));

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.error).toBeUndefined();
    expect(result.current.messages).toMatchObject([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: [{ type: 'text', text: 'survived' }] },
    ]);
  });

  describe('abort', () => {
    it('cancels the in-flight request and clears isStreaming', async () => {
      let signalCaptured: AbortSignal | undefined;
      const fetchFn = jest.fn(
        (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          signalCaptured = init?.signal ?? undefined;
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          });
        }
      );

      const { result } = renderHook(() => useChat({ api: '/chat', fetch: fetchFn }));

      act(() => {
        void result.current.send('hi');
      });

      await waitFor(() => expect(fetchFn).toHaveBeenCalled());
      expect(result.current.isStreaming).toBe(true);

      act(() => {
        result.current.abort();
      });

      await waitFor(() => expect(result.current.isStreaming).toBe(false));
      expect(signalCaptured?.aborted).toBe(true);
      expect(result.current.error).toBeUndefined();
    });

    it('drops events that arrive after abort', async () => {
      let pushFn!: (event: AgentEvent) => void;
      let closeFn!: () => void;
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          pushFn = (event) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          closeFn = () => controller.close();
        },
      });
      const fetchFn = jest.fn(
        async (): Promise<Response> =>
          new Response(body, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          })
      );

      const { result } = renderHook(() => useChat({ api: '/chat', fetch: fetchFn }));

      let sendPromise!: Promise<void>;
      act(() => {
        sendPromise = result.current.send('hi');
      });
      await waitFor(() => expect(fetchFn).toHaveBeenCalled());

      act(() => {
        result.current.abort();
      });
      expect(result.current.isStreaming).toBe(false);

      // Push a late event after abort. The for-await loop should hit the
      // `if (!isCurrent()) return;` guard and exit without folding it into
      // state. Awaiting sendPromise is the real synchronization barrier:
      // runStream resolves via the early return.
      const lateAssistant = makeFinalAssistant('late');
      pushFn({ type: 'agent_end', messages: [makeUser('hi'), lateAssistant] });
      closeFn();
      await act(async () => {
        await sendPromise;
      });

      expect(result.current.messages).toMatchObject([{ role: 'user', content: 'hi' }]);
      expect(result.current.messages).toHaveLength(1);
    });
  });

  describe('respondWithDecision', () => {
    it('attaches the decision and re-POSTs with the augmented log', async () => {
      const assistantWithToolCall = makeAssistantWithToolCall();
      const final = makeFinalAssistant('done');
      const userEcho = makeUser('hi');

      const fetchFn = jest.fn(
        async (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
          streamFromEvents([
            { type: 'agent_start' },
            { type: 'message_start', message: userEcho },
            { type: 'message_end', message: userEcho },
            { type: 'message_start', message: assistantWithToolCall },
            { type: 'message_end', message: assistantWithToolCall },
            {
              type: 'tool_decision_pending',
              toolCallId: 'call_1',
              toolName: 'echo',
              input: { text: 'hi' },
              schema: { type: 'object' },
            },
          ])
      );

      const onDecisionPending = jest.fn();
      const { result } = renderHook(() =>
        useChat({ api: '/chat', fetch: fetchFn, onDecisionPending })
      );

      await act(async () => {
        await result.current.send('hi');
      });

      expect(onDecisionPending).toHaveBeenCalledWith(
        expect.objectContaining({ toolCallId: 'call_1', toolName: 'echo' })
      );
      expect(result.current.pendingDecision).toMatchObject({ toolCallId: 'call_1' });
      // Pause = stream ended, hook idle, awaiting a decision.
      expect(result.current.isStreaming).toBe(false);

      const resumedAssistant: AssistantMessage = {
        ...assistantWithToolCall,
        content: [
          {
            type: 'toolCall',
            id: 'call_1',
            name: 'echo',
            arguments: { text: 'hi' },
            rawArguments: '{"text":"hi"}',
            decision: 'allow',
          },
        ],
      };
      const toolResult: Message = {
        role: 'toolResult',
        toolCallId: 'call_1',
        toolName: 'echo',
        content: [{ type: 'text', text: 'hi' }],
        isError: false,
        timestamp: 2,
      };

      fetchFn.mockImplementationOnce(
        async (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
          streamFromEvents([
            { type: 'agent_start' },
            {
              type: 'agent_end',
              messages: [userEcho, resumedAssistant, toolResult, final],
            },
          ])
      );

      await act(async () => {
        await result.current.respondWithDecision('call_1', 'allow');
      });

      expect(fetchFn).toHaveBeenCalledTimes(2);
      const secondInit = fetchFn.mock.calls[1][1] as RequestInit;
      const sent = JSON.parse(secondInit.body as string);
      expect(sent.messages).toHaveLength(2);
      expect(sent.messages[1].content[0]).toMatchObject({
        type: 'toolCall',
        id: 'call_1',
        decision: 'allow',
      });

      expect(result.current.messages).toHaveLength(4);
      expect(result.current.pendingDecision).toBeUndefined();
      expect(result.current.isStreaming).toBe(false);
    });

    it('finds the pending assistant by toolCallId when a later message was appended', async () => {
      // Simulates the queue-based architecture: a system note (modelled as a
      // user-role message) lands after the pause, so the trailing message is
      // not the assistant carrying the pending tool call.
      const assistantWithToolCall = makeAssistantWithToolCall();
      const trailingNote = makeUser('queued note arrived after pause', 99);
      const initial: Message[] = [
        makeUser('hi'),
        assistantWithToolCall,
        trailingNote,
      ];
      const fetchFn = jest.fn(
        async (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
          streamFromEvents([
            { type: 'agent_start' },
            { type: 'agent_end', messages: initial },
          ])
      );

      const { result } = renderHook(() =>
        useChat({ api: '/chat', fetch: fetchFn, initialMessages: initial })
      );

      await act(async () => {
        await result.current.respondWithDecision('call_1', 'allow');
      });

      const sent = JSON.parse(fetchFn.mock.calls[0][1]!.body as string);
      expect(sent.messages).toHaveLength(3);
      expect(sent.messages[1].content[0]).toMatchObject({
        type: 'toolCall',
        id: 'call_1',
        decision: 'allow',
      });
      // Trailing note is preserved in its position.
      expect(sent.messages[2]).toMatchObject({ role: 'user', content: 'queued note arrived after pause' });
    });

    it('throws when no assistant has a pending decision for the toolCallId', async () => {
      const { result } = renderHook(() => useChat({ api: '/chat' }));

      await expect(
        act(async () => {
          await result.current.respondWithDecision('call_unknown', 'allow');
        })
      ).rejects.toThrow(/No pending decision for toolCallId 'call_unknown'/);
    });

    it('skips assistants whose matching toolCall already has a decision', async () => {
      // Two assistants with different pending toolCallIds. Only the second
      // matches; the first should be ignored even though it has a decision
      // already attached for its own (unrelated) call.
      const earlierWithResolvedDecision = makeFakeAssistantMessage({
        stopReason: 'toolUse',
        content: [
          {
            type: 'toolCall',
            id: 'call_resolved',
            name: 'echo',
            arguments: { text: 'first' },
            rawArguments: '{"text":"first"}',
            decision: 'allow',
          },
        ],
      });
      const laterPending = makeAssistantWithToolCall();
      const initial: Message[] = [
        makeUser('first'),
        earlierWithResolvedDecision,
        makeUser('second'),
        laterPending,
      ];
      const fetchFn = jest.fn(
        async (_url: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
          streamFromEvents([
            { type: 'agent_start' },
            { type: 'agent_end', messages: initial },
          ])
      );

      const { result } = renderHook(() =>
        useChat({ api: '/chat', fetch: fetchFn, initialMessages: initial })
      );

      await act(async () => {
        await result.current.respondWithDecision('call_1', 'allow');
      });

      const sent = JSON.parse(fetchFn.mock.calls[0][1]!.body as string);
      // Earlier assistant's already-resolved decision is untouched.
      expect(sent.messages[1].content[0]).toMatchObject({
        type: 'toolCall',
        id: 'call_resolved',
        decision: 'allow',
      });
      // Later assistant's matching call gets the new decision.
      expect(sent.messages[3].content[0]).toMatchObject({
        type: 'toolCall',
        id: 'call_1',
        decision: 'allow',
      });
    });
  });

  describe('error handling', () => {
    it('sets error on a non-200 response', async () => {
      const fetchFn = jest.fn(
        async (): Promise<Response> =>
          new Response('boom', { status: 500, statusText: 'Internal Server Error' })
      );
      const { result } = renderHook(() => useChat({ api: '/chat', fetch: fetchFn }));

      await act(async () => {
        await result.current.send('hi');
      });

      expect(result.current.error).toEqual(new Error('HTTP 500: Internal Server Error'));
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.messages).toMatchObject([{ role: 'user', content: 'hi' }]);
    });

    it('sets error on a network failure', async () => {
      const fetchFn = jest.fn(async (): Promise<Response> => {
        throw new Error('network down');
      });
      const { result } = renderHook(() => useChat({ api: '/chat', fetch: fetchFn }));

      await act(async () => {
        await result.current.send('hi');
      });

      expect(result.current.error).toEqual(new Error('network down'));
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.messages).toMatchObject([{ role: 'user', content: 'hi' }]);
    });
  });
});
