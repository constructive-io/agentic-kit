# @agentic-kit/memory

Memory and state persistence for AgenticKit - SQLite-based conversation memory.

## Installation

```bash
npm install @agentic-kit/memory
```

## Usage

```typescript
import { SQLiteMemoryStore, ConversationMemory } from '@agentic-kit/memory';

// Basic memory store
const store = new SQLiteMemoryStore('./memory.db');
await store.save('key', { data: 'value' });
const data = await store.load('key');

// Conversation memory
const memory = new ConversationMemory('session-123', './conversations.db');
await memory.saveEvent(event);
const events = await memory.getEvents();
```

## Features

- SQLite-based persistence
- Conversation history management
- Context storage and retrieval
- Session-based memory isolation

## API Reference

- `SQLiteMemoryStore` - Basic key-value storage
- `ConversationMemory` - Session-based conversation memory
