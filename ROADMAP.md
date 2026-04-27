# Agentic Kit Roadmap

This document plans the next phases of work for `agentic-kit`. It supersedes
neither `REDESIGN_DECISIONS.md` nor `README.md` — those describe what exists.
This describes what will exist next, why, and what is explicitly out of scope.

## Current State (snapshot)

| Package                  | Status                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `agentic-kit`            | Core portability layer. Streaming, message model, providers registry, cross-provider transforms, usage/cost. |
| `@agentic-kit/agent`     | Sequential agent loop. Tool execution, lifecycle events, abort/continue, JSON Schema validation.             |
| `@agentic-kit/anthropic` | Provider adapter. Streaming, thinking, tool calls, multimodal, abort.                                        |
| `@agentic-kit/openai`    | Provider adapter. Streaming, reasoning, tool calls, multimodal, abort. OpenAI-compatible endpoints.          |
| `@agentic-kit/ollama`    | Provider adapter. Local inference, embeddings. **Tool execution in streaming is a stub.**                    |

The agent loop today runs to completion in-process: it does not pause for
out-of-band input and has no transport layer above it. Consumers wire it into
their own HTTP layer and supply their own React bindings.

## Design Principles (carried forward)

- Provider-agnostic core; OpenAI-compatible is a compatibility class, not a brand.
- No schema-library coupling at the core (JSON Schema only).
- Normalize provider differences inward; do not leak them.
- Runtime-agnostic; consume standard Web platform primitives (`Response`,
  `ReadableStream`, `AbortSignal`, `fetch`).
- Headless. The kit ships no opinionated UI.
- Composable. Core stays minimal; extensions are opt-in packages.
- Storage is pluggable. Defaults work for development; production swaps in.

## Phase 0 — Test Infrastructure (do first)

Phase 1 cannot land cleanly without a small set of shared test helpers. Build
these first; everything afterward inherits the same testing idiom.

### 0.1 Test Conventions

Three rules the kit follows:

1. **Deterministic by default.** Every package's default `pnpm test` runs only
   unit tests against scripted mocks. No network, no API keys, no flakes.
2. **Live tests are gated and opt-in.** Files named `*.live.test.ts` and
   workspace scripts like `test:live:*` exist for exercising real provider
   APIs. Never required in CI by default.
3. **One environment per package.** Most packages run `testEnvironment: 'node'`.
   The single exception is `@agentic-kit/react`, which runs `jsdom`. There is
   no workspace-wide jsdom; the asymmetry is intentional.

### 0.2 Shared Test Helpers (repo-internal, not a package)

The kit needs a small set of reusable test helpers — scripted providers, SSE
stubs, parsers, contract suites. These live as a **repo-internal directory**,
not a published package and not a workspace package.

Layout: `tools/test/` at the repo root, plain `.ts` files, imported via a
tsconfig `paths` alias (e.g., `@test/scripted-provider`) from each package's
test config. No `package.json`, no version, no public API surface, no
publishing concerns.

Why not a package:
- Dev-only code in a `"private": true` workspace package is a publishing
  ceremony with no upside; the alternative is a directory.
- Promotes test code to a load-bearing public API the moment a consumer
  installs it.
- Reference: AI SDK keeps its test helpers in-package, not as a separate
  workspace package.

Helpers live wherever they are simplest to maintain: shared idioms in
`tools/test/`, package-specific helpers co-located in that package's
`__tests__/`. Duplication of a 30-line scripted provider across packages is
acceptable; promotion to `tools/test/` happens when a third package needs the
same helper.

```ts
// scripted mock provider — replaces inline streamFn boilerplate
function createScriptedProvider(opts: {
  responses: AssistantMessageResponse[]
  delayMs?: number
}): ProviderAdapter

// SSE response stub for serialization tests and useChat fetch mocks
function createScriptedSSEResponse(events: AgentEvent[]): Response

// SSE parser for assertions on emitted bytes
function parseSSEStream(stream: ReadableStream<Uint8Array>): AsyncIterable<AgentEvent>

// portable contract suite for any RunStore implementation
function runRunStoreContractTests(makeStore: () => RunStore | Promise<RunStore>): void

// small fixtures
function makeFakeModel(overrides?: Partial<ModelDescriptor>): ModelDescriptor
```

Existing tests that inline-construct a scripted provider migrate to use the
helper as part of this phase. No behavior change; cleanup only.

If a consumer application later wants to write provider-mocking tests of its
own, it copies the relevant helper (each is small) rather than installing a
dep. That is intentional.

### 0.3 Integration Test Lane

A workspace-level `pnpm test:integration` script. Brings up
`http.createServer` in-process, runs `agent.start(...).toResponse()` against
it, exercises pause/resume across a real HTTP boundary via `fetch`. Mock
providers, real HTTP, real serialization. Catches wire-format and abort
regressions that pure unit tests miss.

Optional in Phase 1 PRs; required for any 1.0 release of `@agentic-kit/agent`'s
new pause/resume APIs.

### 0.4 SSE Wire-Format Tests

A dedicated `__tests__/sse.test.ts` in `@agentic-kit/agent` covers parser
edge cases: chunks split mid-event, multi-line `data:` lines, comment lines,
event-type framing, trailing newlines, mid-event abort. Easy to under-test,
easy to break silently. Hand-crafted byte sequences only; no provider in
the loop.

---

## Phase 1 — Pause/Resume + React Bindings (must)

The single architectural change behind Phase 1: the agent loop becomes
**checkpoint-able**. Tools may declare a `decision` schema; when the loop hits
such a tool, it persists run state, emits a structured event, and waits for a
matching decision payload before continuing. Everything else in Phase 1 follows
from this.

### 1.1 Pausable Tools

#### Problem

Many real agent flows need structured input from outside the loop before a
tool can be considered safe or actionable: human approval on destructive
operations, multi-choice routing on a generated proposal, signed authorization,
delayed completion of a long-running external job. Today the loop has no way
to express this — tools must either run unconditionally or be elided.

#### Design

Extend `AgentTool` with an optional `decision` JSON Schema. The agent loop:

1. When the LLM emits a call to a tool that declares `decision`:
   - Validate the LLM's input against `parameters` as today.
   - Emit a `tool_decision_pending` event with the input and the schema.
   - Persist the run via the configured `RunStore` (see 1.2).
   - Halt the loop and return.
2. The host invokes `agent.resume(runId, decision)`:
   - Load run state from the `RunStore`.
   - Validate `decision` against the tool's `decision` schema.
   - Call `tool.execute(input, decision, ctx)`.
   - Continue the loop with the result.

Tools without a `decision` schema run as today — synchronously inside the loop.

#### API

```ts
interface AgentTool extends ToolDefinition {
  label: string
  decision?: JsonSchema           // optional; declares structured outside-input
  execute(
    toolCallId: string,
    input: Record<string, unknown>,
    decision: unknown,            // undefined for non-pausable tools
    signal?: AbortSignal,
    onUpdate?: (partial: AgentToolResult) => void,
  ): Promise<AgentToolResult>
}

class Agent {
  // existing
  prompt(input: string | Message): Promise<void>
  abort(): void

  // new
  resume(runId: string, decision: unknown): Promise<void>
}

type AgentEvent =
  // ... existing events
  | { type: 'tool_decision_pending'
      runId: string
      toolCallId: string
      toolName: string
      input: Record<string, unknown>
      schema: JsonSchema }
```

A pausable tool with no `decision` is invalid — the field's presence is the
mechanism. Validation runs before `execute` is called; a malformed decision
rejects with a typed error and does not consume the run.

#### Naming

The field is named **`decision`** because the dominant case is a user or
upstream system choosing how the tool should proceed. The variable inside
`execute` is also `decision`; React surfaces it as `respondWithDecision`. If
later phases introduce a categorically different out-of-band input (e.g., raw
results from a client-executed tool), it gets a sibling field with its own
shape — the kit does not over-generalize now.

#### Testing

Unit tests in `@agentic-kit/agent`. Uses `createScriptedProvider` from 0.2.

- Scripted provider emits a tool call to a `decision`-bearing tool. Assert:
  `tool_decision_pending` event emitted, `runStore.save` called, loop halted.
- `agent.resume(runId, valid)` with a fresh scripted response. Assert:
  `tool.execute` invoked with the decision argument, loop continues, final
  event emitted.
- Resume with a decision that fails schema validation. Assert: typed
  validation error, run not consumed, retry permitted.
- Resume with non-existent `runId`. Assert: typed `RunNotFound` error.
- `agent.abort()` while paused. Assert: clean cancellation, run cleaned up.
- Tool without `decision` still runs synchronously (regression guard).

### 1.2 RunStore

#### Problem

Pause/resume across HTTP requests requires the loop's state to survive between
the pause and the resume call. The kit must define where that state lives
without forcing a specific backend on consumers.

#### Design

A small interface plus a default implementation. The kit owns the schema of
what gets persisted (the run record); the consumer owns where it lands.

```ts
interface AgentRun {
  id: string
  model: string
  systemPrompt?: string
  tools: ToolDefinition[]
  messages: Message[]
  pending?: {
    toolCallId: string
    toolName: string
    input: Record<string, unknown>
  }
  createdAt: number
  updatedAt: number
}

interface RunStore {
  save(run: AgentRun): Promise<void>
  load(id: string): Promise<AgentRun | undefined>
  delete(id: string): Promise<void>
}

class MemoryRunStore implements RunStore { /* default, ephemeral */ }
```

`@agentic-kit/agent` ships `MemoryRunStore` for development and single-process
deployments. Production users supply a Redis-, KV-, or DB-backed implementation.
The kit ships no production backend.

The kit deliberately does **not** persist final conversation history. That is a
consumer concern. See 1.4 for lifecycle hooks.

#### Testing

Unit tests in `@agentic-kit/agent`.

- `MemoryRunStore`: save → load round-trip; `load` of missing id returns
  `undefined`; `delete` is idempotent; `delete` then `load` returns `undefined`.
- `runRunStoreContractTests(makeMemoryStore)` from 0.2 runs the portable
  contract suite against `MemoryRunStore`. The same export is consumed by
  any third-party `RunStore` implementation.
- Concurrent save/load on the same id (last write wins, no torn reads).
- Re-pause `createdAt` preservation: a second `save()` of the same run id keeps
  the original `createdAt`; only `updatedAt` advances. (1.1 does not yet
  enforce this — fold into the contract suite.)
- Abort-during-save race: `agent.abort()` while a `runStore.save()` is
  in-flight resolves without orphaning the persisted record or surfacing a
  rejected save promise.
- Mixed-batch tool ordering: when an assistant turn contains a regular tool
  call followed by a decision-bearing tool whose arguments fail validation,
  the persisted `messages` order matches the LLM's tool-call order. (Latent
  in 1.1's invalid-args branch; surfaces only via the contract suite.)

### 1.3 Run Serialization Helpers

#### Problem

The agent emits a stream of typed events. To use it across an HTTP boundary —
or any boundary that requires bytes — the consumer needs to serialize. The
kit should ship the canonical form so consumers do not reinvent it.

#### Design

Standard Web primitives only. No framework helpers. The agent run object
exposes both pull-based and push-based access.

```ts
interface AgentRunHandle {
  events(): AsyncIterable<AgentEvent>
  toReadableStream(): ReadableStream<AgentEvent>
  toResponse(init?: ResponseInit): Response   // SSE-shaped body
}

const handle = agent.start({ messages, ... })
return handle.toResponse()
```

`toResponse` returns a `Response` with `Content-Type: text/event-stream`, each
`AgentEvent` serialized as one SSE frame. Compatible with any runtime that
speaks standard `Response` and `ReadableStream`: Next.js App Router, Hono,
Bun, Deno, Cloudflare Workers, raw Node 18+.

A symmetric pair handles resume:

```ts
const handle = agent.resumeRun({ runId, decision, runStore })
return handle.toResponse()
```

The wire format is the kit's `AgentEvent` discriminated union, serialized as
JSON in SSE `data:` lines. No translation to any third-party protocol; if a
consumer wants to bridge to one, they write the bridge.

#### Testing

Unit tests in `@agentic-kit/agent`.

- `events()`: scripted provider events come out of the async iterable in
  emission order with correct shapes.
- `toReadableStream()`: bytes parsed back via `parseSSEStream` (from 0.2)
  reproduce the original event sequence.
- `toResponse()`: assert `Content-Type: text/event-stream`, no caching headers,
  body parses as above.
- Wire-format edge cases live in `__tests__/sse.test.ts` (0.4): split chunks,
  multi-line `data:`, comments, trailing newlines, mid-event abort.
- Backpressure: stream consumer pauses; producer respects it (no unbounded
  buffer).

### 1.4 `@agentic-kit/react`

#### Problem

The dominant consumer surface is browser UIs that stream from an agent endpoint.
A canonical React hook avoids every consumer reimplementing the same fetch /
parse / state-update / abort / resume loop.

#### Design

One hook. Headless — returns state and actions; renders nothing. Persistence
is delegated to the consumer via lifecycle callbacks.

```ts
import { useChat } from '@agentic-kit/react'

const chat = useChat({
  api: '/api/chat',
  body: () => ({ /* extra request body fields */ }),
  initialMessages: storedMessages,
  onMessage: (m) => {},          // streaming partial state
  onFinish: (m) => {},           // turn complete; consumer may persist
  onDecisionPending: (event) => {},  // tool paused; consumer renders UI
})

chat.send('hello')
chat.respondWithDecision(value)  // delivers decision to /resume
chat.abort()
chat.messages         // Message[]
chat.isStreaming      // boolean
chat.pendingDecision  // event | undefined
chat.error            // unknown | undefined
```

Behaviors the hook is responsible for:

- POSTing to `api` with `messages` plus any consumer-supplied body fields.
- Parsing the SSE response into `AgentEvent`s and folding them into `messages`.
- Emitting `onMessage` per partial update, `onFinish` per turn end.
- Surfacing `tool_decision_pending` events as `chat.pendingDecision` and via
  `onDecisionPending`.
- Rebroadcasting `respondWithDecision(value)` as a POST to `/resume` (path
  configurable) with `{ runId, decision }`, and resuming stream consumption
  from the response.
- Plumbing an `AbortSignal` through `chat.abort()`.

The hook does not own persistence, modes, system prompts, or any UI shape.

#### Testing

The only package using `testEnvironment: 'jsdom'`. Adds devDeps:
`jest-environment-jsdom`, `@testing-library/react`, `react`, `react-dom`. Adds
peerDeps: `react`, `react-dom`. `globalThis.fetch` is stubbed per-test to
return `createScriptedSSEResponse(events)` from 0.2.

- Send → stream → finish: messages assemble in order; `isStreaming` transitions;
  `onMessage` and `onFinish` fire with correct payloads.
- `body()` callback's fields appear in the POST body.
- `chat.abort()` reaches the fetch mock's `AbortSignal`; state cleans up; no
  late updates after abort.
- Decision-pending: `onDecisionPending` fires; `chat.pendingDecision` set;
  `respondWithDecision(value)` POSTs to `/resume` with `{ runId, decision }`;
  the resumed stream folds into `messages`.
- Network error / non-200 response: `chat.error` set; `messages` not corrupted.
- Malformed SSE bytes: hook surfaces an error rather than crashing.
- `initialMessages` hydrates state on mount.

---

## Phase 2 — Production Polish (should)

### 2.1 Prompt Caching API

The kit currently reads `cacheRead` and `cacheWrite` from `Usage` but exposes
no API to *set* cache control on outgoing messages. Both Anthropic and OpenAI
(via Anthropic-compatible providers and recent OpenAI features) support
prompt caching, and the cost savings are material at scale.

Design sketch: add an optional `cache?: 'short' | 'long'` flag at the message
level (or at content-block level). Each provider adapter translates to its
native control mechanism (Anthropic `cache_control: { type: 'ephemeral' }`,
OpenAI cache strategy hints). The flag is advisory; providers without support
ignore it.

#### Testing

Unit tests per provider adapter, matching the existing
`anthropic.test.ts` / `openai.test.ts` idiom.

- Mock HTTP intercepts the outgoing request body and headers.
- Build a `Context` whose messages carry `cache: 'short' | 'long'`.
- Anthropic: assert `cache_control: { type: 'ephemeral' }` on flagged blocks.
- OpenAI: assert the corresponding native cache hint.
- Ollama and other no-support providers: assert the flag is silently ignored,
  no error.
- `Usage.cacheRead` / `cacheWrite` are populated correctly on the assistant
  response (existing usage assertion pattern).

### 2.2 Telemetry / Middleware Hooks

The agent loop today has no insertion points for observability or
interception. Production consumers need at minimum:

- A `before/after` provider call hook (latency, errors, token counts).
- A `before/after` tool call hook (arguments, results, durations).
- Stream event tap (without buffering the stream).

Design as middleware composition over the run, akin to a small async
interceptor chain. Standard error type for transient vs. terminal failures
to support upstream retry logic.

#### Testing

Unit tests in `@agentic-kit/agent`.

- Register middleware, run a scripted loop, assert hook invocation order and
  arguments (provider request, response, tool call, tool result).
- Multiple middlewares compose left-to-right with predictable ordering.
- A throwing middleware does not crash the loop; the error surfaces via the
  defined channel.
- `before/after` pairs see matching correlation IDs (request ↔ response).
- Stream-event tap does not buffer or reorder events.

---

## Phase 3 — Optional Extensions (could)

### 3.1 Full Ollama Tool Support

The Ollama adapter currently does not parse tool calls in streaming responses.
Bring it to feature parity with the Anthropic and OpenAI adapters: tool call
deltas, tool result round-trips, and live tests covering the full loop.

#### Testing

- Unit: parse scripted Ollama NDJSON tool-call chunks; assert the canonical
  `AssistantMessageEvent` sequence is emitted.
- Live (gated, in `ollama.live.test.ts`): tool-using smoke test against a
  known-good local Ollama model. Skipped when `OLLAMA_LIVE_MODEL` is unset.

### 3.2 Retry / Backoff

A small built-in retry policy for transient provider failures (HTTP 408, 425,
429, 500, 502, 503, 504; aborted-not-by-user network errors). Configurable
attempt count, jittered exponential backoff. Disabled by default — consumers
opt in. Layered above provider adapters, below the agent loop.

#### Testing

Unit tests using an injectable clock.

- Provider mock returns scripted transient errors then success; assert retry
  count and final outcome.
- Backoff timings match the configured curve (use a fake clock; never sleep
  for real in tests).
- Non-retriable errors (400, 401, 403) fail immediately; no retries attempted.
- Abort during a retry wait cancels promptly; no further attempts.
- Retries respect a global deadline; total time bounded.

### 3.3 Stream Resume on Disconnect

If the agent loop is mid-run when the SSE connection drops, the client should
be able to reconnect with the run ID and pick up where it left off. The
machinery is largely a free side-effect of `RunStore` — the run survives;
only stream-position tracking and an event replay endpoint are new. Useful
for flaky-network and long-running flows.

#### Testing

- Unit: abort an in-flight `events()` iterator. Reload the run by id and call
  `resumeRun`. Assert: events continue from the last-emitted checkpoint, no
  duplicate side effects.
- Integration (lane from 0.3): same flow over real HTTP — drop the connection
  mid-stream, reconnect with `runId`, assert event continuity and correct
  `Last-Event-ID` semantics.

### 3.4 Client-Side Tool Execution

For tools that genuinely require browser-only capabilities (DOM access,
WebRTC, File System Access API, locally-running services, hardware bridges,
wallet signing), introduce a `runs: 'client'` flag. The mechanism reuses the
pause/resume rails: such tools emit a `tool_client_execute_pending` event,
the browser-side dispatcher runs the registered local executor, and the
result returns via the same resume endpoint shape.

This is deferred until a real use case appears. Most agent applications do
not need it, and shipping it prematurely would constrain the design.

#### Testing

- Unit (in `@agentic-kit/agent`): protocol layer only. Scripted provider
  emits a `runs: 'client'` tool call. Assert: `tool_client_execute_pending`
  event fires, loop halts. `agent.resume(runId, { result })` continues with
  the supplied result as the tool result.
- Unit (in `@agentic-kit/react`, jsdom): client dispatcher. Register a local
  executor, fire a synthetic pending event, assert: executor runs with the
  tool input, resulting POST to `/resume` includes the correct payload, the
  resumed stream folds into `messages`.

---

## Non-Goals

The kit will not ship the following. They belong in consumer applications,
companion packages, or other ecosystems entirely.

- **Conversation history persistence.** Lifecycle hooks expose what is needed;
  storage is consumer-owned. Browser, server, sync model — none of it is the
  kit's call.
- **Structured output / `generateObject` analog.** Tool calls already provide
  typed structured outputs via JSON Schema. A second mechanism is redundant.
- **Schema library coupling.** No `@agentic-kit/zod`, no `@agentic-kit/typebox`.
  Consumers convert their schema library of choice to JSON Schema at the
  boundary; this is a one-line operation for every popular library.
- **Framework-specific helpers.** No Next.js, Hono, Express, Fastify packages.
  Standard `Response` and `ReadableStream` cover all of them.
- **UI rendering / component library.** The kit is headless. React hook
  exposes state and actions; consumers render however they want.
- **Embeddings as a primary capability.** Per `REDESIGN_DECISIONS.md` #14,
  embeddings live behind an optional capability interface or companion
  package, not in the conversational core.
- **System prompt construction utilities.** Prompt design is consumer-owned.
- **Conversation modes / agent personas.** Application concern.
- **Built-in production storage backends.** `MemoryRunStore` is the only
  implementation the kit ships; Redis, KV, DB backends are for consumers.

## Package Layout After Phase 1

| Package                  | Change                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `agentic-kit`            | unchanged                                                                                   |
| `@agentic-kit/agent`     | extended: pausable tools, `RunStore`, run serialization helpers, middleware hooks (Phase 2) |
| `@agentic-kit/anthropic` | unchanged in Phase 1; caching API in Phase 2                                                |
| `@agentic-kit/openai`    | unchanged in Phase 1; caching API in Phase 2                                                |
| `@agentic-kit/ollama`    | unchanged in Phase 1; tool support in Phase 3                                               |
| `@agentic-kit/react`     | **new** — `useChat` hook                                                                    |

Shared test helpers live in `tools/test/` (repo-internal directory, not a
package). Phase 2 and 3 add no new packages; everything extends in place.

## Open Questions

- **Run record schema versioning.** Once `RunStore` is shipped, the on-disk
  `AgentRun` shape becomes a compatibility surface. Decide on an explicit
  version field and migration story before 1.0.
- **Decision schema validator scope.** Resolved (1.1): the decision validator
  reuses `validateSchema` from `packages/agent/src/validation.ts` — same code
  path as tool inputs. Discriminated-union and `oneOf` / `anyOf` coverage is
  still untested; fold into the 1.2 contract suite.
- **Lifecycle events across pause boundaries.** On resume, `agent_start`
  re-fires (each `runLoop` entry is a fresh start) but `turn_start` does not
  (the persisted assistant message is reused, not regenerated). This
  asymmetry is invisible to a single-prompt consumer but matters for any
  listener that tracks turn vs. run lifecycle. Decide before 1.4 whether to
  introduce a distinct `agent_resume` event or to redocument `agent_start`
  with explicit "loop entry" semantics — the `@agentic-kit/react` hook will
  codify whichever choice externally.
- **SSE vs. NDJSON.** SSE is the proposed default. NDJSON is simpler but lacks
  reconnection semantics and event-type framing. Revisit if real-world
  consumers report SSE problems behind specific proxies.
- **`onDecisionPending` ergonomics.** Whether the React hook should auto-route
  the next stream from `/resume` or require the consumer to call a follow-up
  method explicitly. Default to auto for ergonomics; expose an opt-out.
- **Live test policy for paid providers.** Anthropic/OpenAI live tests would
  burn API credits. Default position: gated `*.live.test.ts` files with
  env-var keys, manually triggered, never required by per-PR CI.
