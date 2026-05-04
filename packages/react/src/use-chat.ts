import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AgentEvent } from '@agentic-kit/agent';
import { parseSSEStream } from '@agentic-kit/agent';
import type { AssistantMessage, Message } from 'agentic-kit';
import { createUserMessage } from 'agentic-kit';

export type ToolDecisionPendingEvent = Extract<AgentEvent, { type: 'tool_decision_pending' }>;

export interface UseChatOptions {
  api: string;
  body?: () => Record<string, unknown>;
  initialMessages?: Message[];
  onMessage?: (message: Message) => void;
  onFinish?: (message: AssistantMessage) => void;
  onDecisionPending?: (event: ToolDecisionPendingEvent) => void;
  fetch?: typeof globalThis.fetch;
}

export interface UseChatResult {
  messages: Message[];
  isStreaming: boolean;
  pendingDecision: ToolDecisionPendingEvent | undefined;
  error: unknown;
  send: (input: string | Message) => Promise<void>;
  respondWithDecision: (toolCallId: string, value: unknown) => Promise<void>;
  abort: () => void;
}

export function useChat(options: UseChatOptions): UseChatResult {
  const [messages, setMessages] = useState<Message[]>(() => options.initialMessages ?? []);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<ToolDecisionPendingEvent | undefined>(
    undefined
  );
  const [error, setError] = useState<unknown>(undefined);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const runIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const runStream = useCallback(
    async (requestMessages: Message[], optimisticUserMessage: Message | null): Promise<void> => {
      const opts = optionsRef.current;
      const myRun = ++runIdRef.current;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const isCurrent = () => runIdRef.current === myRun;

      setIsStreaming(true);
      setError(undefined);
      setPendingDecision(undefined);
      if (optimisticUserMessage) {
        setMessages((prev) => [...prev, optimisticUserMessage]);
      }

      let skipUserEcho = optimisticUserMessage !== null;

      const fetchFn = opts.fetch ?? globalThis.fetch;
      const extraBody = opts.body?.() ?? {};

      let response: Response;
      try {
        response = await fetchFn(opts.api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: requestMessages, ...extraBody }),
          signal: controller.signal,
        });
      } catch (err) {
        if (!isCurrent()) return;
        if (controller.signal.aborted) {
          if (isCurrent()) setIsStreaming(false);
          return;
        }
        setError(err);
        setIsStreaming(false);
        return;
      }

      if (!isCurrent()) return;

      if (!response.ok) {
        setError(new Error(`HTTP ${response.status}: ${response.statusText}`));
        setIsStreaming(false);
        return;
      }

      if (!response.body) {
        setError(new Error('Response has no body'));
        setIsStreaming(false);
        return;
      }

      try {
        for await (const event of parseSSEStream(response.body)) {
          if (!isCurrent()) return;

          switch (event.type) {
            case 'message_start': {
              if (skipUserEcho && event.message.role === 'user') {
                skipUserEcho = false;
                break;
              }
              setMessages((prev) => {
                if (!isCurrent()) return prev;
                return [...prev, event.message];
              });
              break;
            }
            case 'message_update': {
              setMessages((prev) => {
                if (!isCurrent()) return prev;
                if (prev.length === 0) return prev;
                const last = prev[prev.length - 1];
                if (last.role !== 'assistant') return prev;
                return [...prev.slice(0, -1), event.message];
              });
              break;
            }
            case 'message_end': {
              if (event.message.role === 'assistant') {
                setMessages((prev) => {
                  if (!isCurrent()) return prev;
                  if (prev.length === 0) return [event.message];
                  const last = prev[prev.length - 1];
                  if (last.role === 'assistant') {
                    return [...prev.slice(0, -1), event.message];
                  }
                  return [...prev, event.message];
                });
              }
              opts.onMessage?.(event.message);
              break;
            }
            case 'tool_decision_pending': {
              setPendingDecision(event);
              opts.onDecisionPending?.(event);
              break;
            }
            case 'agent_end': {
              setMessages(() => {
                if (!isCurrent()) return messagesRef.current;
                return event.messages;
              });
              const lastAssistant = [...event.messages]
                .reverse()
                .find((m): m is AssistantMessage => m.role === 'assistant');
              if (lastAssistant) {
                opts.onFinish?.(lastAssistant);
              }
              break;
            }
          }
        }
      } catch (err) {
        if (!isCurrent()) return;
        if (controller.signal.aborted) return;
        setError(err);
      } finally {
        if (isCurrent()) {
          setIsStreaming(false);
          abortControllerRef.current = null;
        }
      }
    },
    []
  );

  const send = useCallback(
    async (input: string | Message): Promise<void> => {
      const userMessage: Message = typeof input === 'string' ? createUserMessage(input) : input;
      const requestMessages = [...messagesRef.current, userMessage];
      await runStream(requestMessages, userMessage);
    },
    [runStream]
  );

  const respondWithDecision = useCallback(
    async (toolCallId: string, value: unknown): Promise<void> => {
      const current = messagesRef.current;
      let targetIdx = -1;
      for (let i = current.length - 1; i >= 0; i--) {
        const msg = current[i];
        if (msg.role !== 'assistant') continue;
        const match = msg.content.find(
          (block) => block.type === 'toolCall' && block.id === toolCallId
        );
        if (!match) continue;
        if ('decision' in match && match.decision !== undefined) continue;
        targetIdx = i;
        break;
      }
      if (targetIdx === -1) {
        throw new Error(
          `No pending decision for toolCallId '${toolCallId}'`
        );
      }
      const target = current[targetIdx] as AssistantMessage;
      const updatedAssistant: AssistantMessage = {
        ...target,
        content: target.content.map((block) => {
          if (block.type !== 'toolCall' || block.id !== toolCallId) {
            return block;
          }
          return { ...block, decision: value };
        }),
      };
      const requestMessages = [
        ...current.slice(0, targetIdx),
        updatedAssistant,
        ...current.slice(targetIdx + 1),
      ];
      setMessages(requestMessages);
      messagesRef.current = requestMessages;
      setPendingDecision(undefined);
      await runStream(requestMessages, null);
    },
    [runStream]
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    runIdRef.current++;
    setIsStreaming(false);
  }, []);

  return useMemo(
    () => ({
      messages,
      isStreaming,
      pendingDecision,
      error,
      send,
      respondWithDecision,
      abort,
    }),
    [messages, isStreaming, pendingDecision, error, send, respondWithDecision, abort]
  );
}
