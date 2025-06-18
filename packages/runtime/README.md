# @agentic-kit/runtime

Runtime environments for AgenticKit - Local, Browser, and Docker execution.

## Installation

```bash
npm install @agentic-kit/runtime
```

## Usage

```typescript
import { LocalRuntime, BrowserRuntime, DockerRuntime } from '@agentic-kit/runtime';

// Local execution
const localRuntime = new LocalRuntime();
const result = await localRuntime.execute('echo "Hello World"');

// Browser automation
const browserRuntime = new BrowserRuntime();
await browserRuntime.execute('goto:https://example.com');

// Docker container
const dockerRuntime = new DockerRuntime('ubuntu:latest');
await dockerRuntime.execute('apt-get update');
```

## Available Runtimes

- `LocalRuntime` - Execute commands locally
- `BrowserRuntime` - Browser automation with Playwright
- `DockerRuntime` - Containerized execution

## API Reference

All runtimes implement the `Runtime` interface from `@agentic-kit/core`.
