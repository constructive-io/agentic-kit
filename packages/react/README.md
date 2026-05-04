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
