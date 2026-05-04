'use client';

import { useState } from 'react';

import type { Message } from 'agentic-kit';

interface ToolCallCardProps {
  name: string;
  args: Record<string, unknown>;
  result?: Extract<Message, { role: 'toolResult' }>;
}

export function ToolCallCard({ name, args, result }: ToolCallCardProps) {
  const [open, setOpen] = useState(false);
  const argsSummary = JSON.stringify(args);
  const status = result ? (result.isError ? 'error' : 'done') : 'pending';
  const resultText = result
    ? result.content
        .map((c) => (c.type === 'text' ? c.text : `[${c.type} block]`))
        .join('\n')
    : '';

  return (
    <div className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-mono">
          <span className="text-zinc-500">tool</span>{' '}
          <span className="font-semibold">{name}</span>
          <span className="text-zinc-500">{argsSummary}</span>
        </span>
        <span
          className={
            status === 'done'
              ? 'rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900 dark:text-green-300'
              : status === 'error'
                ? 'rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300'
                : 'rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
          }
        >
          {status}
        </span>
      </button>
      {open && result ? (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px] dark:bg-zinc-950">
          {resultText}
        </pre>
      ) : null}
    </div>
  );
}
