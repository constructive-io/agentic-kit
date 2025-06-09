# Bradie Client

A Node.js client for the Bradie LLM service, providing project initialization, messaging, streaming responses, and log retrieval.

## Installation

```bash
npm install @agentic-kit/bradie
# or
yarn add @agentic-kit/bradie
```

## Usage

```typescript
import { Bradie } from '@agentic-kit/bradie';

// 1. Configure callbacks and create client
const client = new Bradie({
  domain: 'http://localhost:3000',
  onSystemMessage: (msg) => console.log('[system]', msg),
  onAssistantReply: (msg) => console.log('[assistant]', msg),
  onError: (err) => console.error('[error]', err),
  onComplete: () => console.log('[complete]'),
});

// 2. Initialize a project (creates session & project IDs)
const { sessionId, projectId } = await client.initProject(
  'my-project',
  '/path/to/project'
);
console.log('Session ID:', sessionId, 'Project ID:', projectId);

// 3. Send a message and get a request ID
const requestId = await client.sendMessage('Hello, Bradie!');
console.log('Request ID:', requestId);

// 4. Subscribe to streaming logs (chat messages & system events)
await client.subscribeToResponse(requestId);
```

### fetchOnce

Retrieve the complete array of command logs for a given request:

```typescript
const logs = await client.fetchOnce(requestId);
console.log(logs);
```

### npm Subscribe Script

A helper script is included to subscribe to a request from the command line:

```bash
cd packages/bradie
npm run subscribe -- \
  --sessionId <SESSION_ID> \
  --requestId <REQUEST_ID> \
  [--domain http://localhost:3000]
```

## API Reference

- `new Bradie(config: { domain: string; onSystemMessage: (msg: string) => void; onAssistantReply: (msg: string) => void; onError?: (err: Error) => void; onComplete?: () => void; })`
- `.initProject(projectName: string, projectPath: string): Promise<{ sessionId: string; projectId: string }>`
- `.sendMessage(message: string): Promise<string>`
- `.subscribeToResponse(requestId: string, opts?: { pollInterval?: number; maxPolls?: number }): Promise<void>`
- `.fetchOnce(requestId: string): Promise<AgentCommandLog[]>`

## Contributing

Please open issues or pull requests on [GitHub](https://github.com/hyperweb-io/agentic-kit).

---

© Hyperweb (formerly Cosmology). See LICENSE for full licensing and disclaimer. 