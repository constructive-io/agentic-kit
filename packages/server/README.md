# @agentic-kit/server

HTTP API server for AgenticKit - Fastify-based web interface with WebSocket support.

## Installation

```bash
npm install @agentic-kit/server
```

## Usage

```typescript
import { AgenticKitServer } from '@agentic-kit/server';

const server = new AgenticKitServer(3000);
await server.start();

// Server provides:
// - REST API endpoints
// - WebSocket connections
// - Agent execution management
// - Runtime command execution
```

## Features

- Fastify-based HTTP server
- WebSocket support for real-time communication
- CORS and authentication middleware
- Agent and runtime API endpoints

## API Endpoints

- `GET /health` - Health check
- `GET /api/agents` - List available agents
- `POST /api/sessions` - Create new session
- `POST /api/agents/:type/execute` - Execute agent
- `WS /ws` - WebSocket connection

## API Reference

- `AgenticKitServer` - Main server class
- Authentication and rate limiting middleware
- Agent and runtime route handlers
