# @agentic-kit/core

Core framework for AgenticKit - TypeScript implementation of OpenHands.

## Installation

```bash
npm install @agentic-kit/core
```

## Usage

```typescript
import { AgentConfigSchema, logger } from '@agentic-kit/core';

const config = AgentConfigSchema.parse({
  name: 'MyAgent',
  maxIterations: 100,
  temperature: 0.7
});

logger.info('Agent configured', config);
```

## Features

- Event-driven architecture
- Type-safe configuration with Zod
- Structured logging with Pino
- OpenHands-compatible interfaces

## API Reference

- `Agent` - Base agent interface
- `AgentState` - State management
- `Action` & `Observation` - Event types
- `AgentConfigSchema` - Configuration validation
