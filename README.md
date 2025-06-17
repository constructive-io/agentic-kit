# AgenticKit

> 🚀 **NEW**: AgenticKit is now a comprehensive AI agent platform - the TypeScript implementation of OpenHands!

## What's New

AgenticKit has evolved from a simple LLM adapter library into a full-featured AI agent platform equivalent to OpenHands, but built in TypeScript.

## Repository Structure

```
agentic-kit/
├── legacy/             # Legacy LLM adapters (original functionality)
│   ├── agentic-kit/    # Core library (unchanged)
│   ├── bradie/         # Bradie adapter (unchanged)
│   └── ollama/         # Ollama adapter (unchanged)
├── packages/           # New AgenticKit platform packages
│   ├── core/           # Core AgenticKit framework
│   ├── agents/         # Agent implementations
│   ├── runtime/        # Runtime environments
│   └── [more packages...]
└── README.md
```

## Legacy Packages (Simple LLM Integration)

The original LLM adapter functionality is still available and unchanged in the `legacy/` folder:

- **Package names**: Same as before (`agentic-kit`, `@agentic-kit/bradie`, `@agentic-kit/ollama`)
- **Import statements**: No changes needed
- **API**: Fully backward compatible

## Quick Start

### Legacy Adapters (Simple LLM Integration)

For existing users, everything works exactly the same:

```bash
npm install agentic-kit
```

```typescript
import { createOllamaKit } from 'agentic-kit';

const kit = createOllamaKit('http://localhost:11434');
const response = await kit.generate({
  model: 'mistral',
  prompt: 'Hello, how are you?'
});
```

### New AgenticKit Platform (Full Agent Capabilities)

Coming soon! The new AgenticKit will provide:

- 🤖 **Multiple Agent Types**: CodeAct, Browsing, Visual agents
- 🏃 **Runtime Environments**: Docker, Local, Browser, Remote
- 🔧 **Tool Ecosystem**: Extensible tool and plugin system
- 💾 **Memory Management**: Conversation memory and state persistence
- 🌐 **Web Interface**: Real-time web UI and API
- 🔒 **Enterprise Security**: Authentication, authorization, sandboxing

```typescript
// Coming soon!
import { AgenticKit, CodeActAgent } from 'agentic-kit';

const kit = new AgenticKit();
const agent = new CodeActAgent(llm, config);
await kit.runAgent(agent, 'Write a Python script to analyze data');
```

## Development

### Prerequisites

- Node.js (version 18 or higher)
- npm or yarn

### Installation

```bash
git clone https://github.com/hyperweb-io/agentic-kit.git
cd agentic-kit
yarn install
```

### Building packages

```bash
# Build legacy packages
yarn build

# Build new AgenticKit packages (coming soon)
yarn build:packages
```

### Running tests

```bash
yarn test
```   