# @agentic-kit/agents

Agent implementations for AgenticKit - CodeAct, Browsing, and Visual agents.

## Installation

```bash
npm install @agentic-kit/agents
```

## Usage

```typescript
import { CodeActAgent } from '@agentic-kit/agents';
import { AgentConfigSchema } from '@agentic-kit/core';

const config = AgentConfigSchema.parse({
  name: 'MyCodeAgent',
  maxIterations: 50,
  temperature: 0.7
});

const agent = new CodeActAgent(config);
```

## Available Agents

- `CodeActAgent` - Code generation and execution
- `BrowsingAgent` - Web browsing and interaction
- `VisualAgent` - Visual content analysis

## API Reference

All agents implement the `Agent` interface from `@agentic-kit/core`.
