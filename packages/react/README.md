## @agentic-kit/react

Headless React bindings for `agentic-kit`.

Currently exposes a single hook:

- `useChat({ api, body, initialMessages, onMessage, onFinish, onDecisionPending })`
  POSTs `messages` to `api`, parses the SSE response into `AgentEvent`s, and
  folds them into a `Message[]`. Surfaces pause/resume via `pendingDecision` +
  `respondWithDecision(toolCallId, value)`.

The hook ships no UI. State lives in messages — there is no separate run
store, no `runId`. Resumption after a tool decision re-POSTs to the same `api`
endpoint with the augmented message log.

`respondWithDecision(toolCallId, value)` walks `messages` backwards to find
the most recent assistant message that owns a `toolCall` block matching
`toolCallId` with no decision attached, mutates that block, and re-POSTs.
This means callers can append messages (system notes, status writes, etc.)
to the log between the pause and the user's response — the lookup is by id,
not position. Throws if no matching pending decision is found.
