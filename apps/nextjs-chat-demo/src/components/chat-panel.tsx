'use client';

import { useChat } from '@agentic-kit/react';

import { ChatInput } from './chat-input';
import { ChatMessages } from './chat-messages';

const SUGGESTIONS = [
  'What time is it in Tokyo?',
  'Email alice@example.com about the meeting',
  'Tell me a one-liner about React',
];

export function ChatPanel() {
  const chat = useChat({ api: '/api/chat' });

  const showSuggestions = chat.messages.length === 0 && !chat.isStreaming;

  return (
    <section className="flex h-full flex-col gap-3">
      <header className="border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">agentic-kit chat demo</h1>
        <p className="text-xs text-zinc-500">
          Powered by <code>@agentic-kit/react</code> · GPT-5.4-mini · Try the{' '}
          <code>send_email</code> approval flow.
        </p>
      </header>

      <ChatMessages
        messages={chat.messages}
        pendingDecision={chat.pendingDecision}
        respondWithDecision={chat.respondWithDecision}
        isStreaming={chat.isStreaming}
      />

      {chat.error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {String((chat.error as Error)?.message ?? chat.error)}
        </div>
      ) : null}

      {showSuggestions ? (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={() => {
                void chat.send(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <ChatInput
        disabled={chat.isStreaming || chat.pendingDecision !== undefined}
        onSend={(text) => {
          void chat.send(text);
        }}
        placeholder={
          chat.pendingDecision
            ? 'Awaiting your decision on the pending tool call…'
            : 'Type a message…'
        }
      />
    </section>
  );
}
