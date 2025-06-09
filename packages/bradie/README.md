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
  domain: 'http://localhost:3001',
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

### scripts folder

All helper scripts live under `scripts/` in this package. From `packages/bradie` you can run them directly with ts-node:

```bash
cd packages/bradie
ts-node scripts/init.ts --projectName <PROJECT_NAME> --projectPath <PROJECT_PATH> [--domain <domain>]
ts-node scripts/chat.ts --sessionId <SESSION_ID> --message "<MESSAGE>" [--domain <domain>]
ts-node scripts/list-projects.ts [--domain <domain>]
ts-node scripts/get-project.ts --projectId <PROJECT_ID> [--domain <domain>]
ts-node scripts/project-summary.ts --sessionId <SESSION_ID> [--domain <domain>]
ts-node scripts/health.ts [--domain <domain>]
ts-node scripts/instance-info.ts [--domain <domain>]
ts-node scripts/subscribe.ts --sessionId <SESSION_ID> --requestId <REQUEST_ID> [--domain <domain>]
```

Or via the npm shortcuts listed below:

Or via npm:
```bash
npm run init -- --projectName <PROJECT_NAME> --projectPath <PROJECT_PATH> [--domain <domain>]
npm run chat  -- --sessionId <SESSION_ID> --message "<MESSAGE>" [--domain <domain>]
npm run list-projects
npm run get-project -- --projectId <PROJECT_ID>
npm run project-summary -- --sessionId <SESSION_ID>
npm run health
npm run instance-info
npm run subscribe -- --sessionId <SESSION_ID> --requestId <REQUEST_ID>
```
Or via Yarn (no extra "--" needed):
```bash
yarn run init --projectName <PROJECT_NAME> --projectPath <PROJECT_PATH> [--domain <domain>]
yarn run chat  --sessionId <SESSION_ID> --message "<MESSAGE>" [--domain <domain>]
yarn run list-projects
yarn run get-project --projectId <PROJECT_ID>
yarn run project-summary --sessionId <SESSION_ID>
yarn run health
yarn run instance-info
yarn run subscribe --sessionId <SESSION_ID> --requestId <REQUEST_ID>
```

### CLI Scripts

**init**: Initialize a new project (outputs `sessionId` & `projectId`):
```bash
npm run init -- --projectName <PROJECT_NAME> --projectPath <PROJECT_PATH> [--domain <domain>]
```

**chat**: Send a message (outputs `requestId`):
```bash
npm run chat -- --sessionId <SESSION_ID> --message "<MESSAGE>" [--domain <domain>]
```

**subscribe**: Subscribe to request logs (streaming output):
```bash
npm run subscribe -- --sessionId <SESSION_ID> --requestId <REQUEST_ID> [--domain <domain>]
```

**list-projects**: List all projects:
```bash
npm run list-projects [--domain <domain>]
```

**get-project**: Fetch details for a project by its ID:
```bash
npm run get-project -- --projectId <PROJECT_ID> [--domain <domain>]
```

**project-summary**: Fetch summary for a project session:
```bash
npm run project-summary -- --sessionId <SESSION_ID> [--domain <domain>]
```

**health**: Check Bradie server health:
```bash
npm run health [--domain <domain>]
```

**instance-info**: Get Bradie instance information:
```bash
npm run instance-info [--domain <domain>]
```

## API Reference

- `new Bradie(config: { domain: string; onSystemMessage: (msg: string) => void; onAssistantReply: (msg: string) => void; onError?: (err: Error) => void; onComplete?: () => void; })`
- `.getInstanceId(): Promise<{ instanceId: string; port: number }>`
- `.getInstanceInfo(): Promise<{ instance_id: string; backend_port: number; frontend_port?: number }>`
- `.health(): Promise<any>`
- `.initProject(projectName: string, projectPath: string): Promise<{ sessionId: string; projectId: string }>`
- `.listProjects(): Promise<Record<string, any>>`
- `.getProject(projectId: string): Promise<any>`
- `.getProjectSummary(sessionId: string): Promise<any>`
- `.getMode(): Promise<{ mode: string; projectName: string | null; projectPath: string | null }>`
- `.getStatus(sessionId: string): Promise<any>`
- `.postStatus(sessionId: string): Promise<any>`
- `.recoverMessages(sessionId: string): Promise<any[]>`
- `.getFileTree(sessionId: string, instanceId: string): Promise<any>`
- `.readFile(sessionId: string, filePath: string): Promise<{ content: string }>`
- `.writeFile(sessionId: string, filePath: string, content: string): Promise<{ success: boolean }>`
- `.terminalStatus(sessionId: string): Promise<{ status: string; project_path: string }>`
- `.sendMessage(message: string): Promise<string>`
- `.subscribeToResponse(requestId: string, opts?: { pollInterval?: number; maxPolls?: number }): Promise<void>`
- `.fetchOnce(requestId: string): Promise<AgentCommandLog[]>`
- `.transcribe(sessionId: string, file: Blob | Buffer | File): Promise<{ text: string }>`
- `.tts(text: string): Promise<Buffer>`
- `.offlineStatus(): Promise<'available' | 'unavailable'>`
- `.getProjectRepo(sessionId: string): Promise<{ path: string; url: string }>`
- `.stopAgent(sessionId: string): Promise<boolean>`
- `.resetAgent(sessionId: string): Promise<boolean>`
- `.feedback(sessionId: string, feedback: Record<string, any>): Promise<boolean>`
- `.feedbackMessage(sessionId: string, messageId: string, feedback: Record<string, any>): Promise<boolean>`

## Contributing

Please open issues or pull requests on [GitHub](https://github.com/hyperweb-io/agentic-kit).

---

© Hyperweb (formerly Cosmology). See LICENSE for full licensing and disclaimer. 