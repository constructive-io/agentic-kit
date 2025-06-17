# agentic-kit (Legacy)

⚠️ **NOTICE**: This package has been moved to the legacy/ folder to make way for the new AgenticKit platform (OpenHands TypeScript implementation).

## Current Status

This package continues to work exactly as before with the same:
- Package name: `agentic-kit`
- Import statements: `import { createOllamaKit } from 'agentic-kit';`
- API and functionality

## Migration Notice

The package has been moved to `legacy/agentic-kit/` in the repository structure but maintains full backward compatibility. No code changes are required for existing users.

### Future Development

For new projects, consider using the new AgenticKit platform which provides:
- Full OpenHands compatibility
- Advanced agent capabilities
- Runtime environments
- Tool ecosystem
- And much more...

See the main [AgenticKit documentation](../../README.md) for details.

## Usage

### Using the Ollama Kit

```typescript
import { createOllamaKit } from 'agentic-kit';

const kit = createOllamaKit('http://localhost:11434');

// Generate a response
const response = await kit.generate({
  model: 'mistral',
  prompt: 'Hello, how are you?'
});

console.log(response);
```

### Using the Bradie Kit

```typescript
import { createBradieKit } from 'agentic-kit';

const kit = createBradieKit({
  instanceId: 'your-instance-id',
  apiKey: 'your-api-key'
});

// Generate a response
const response = await kit.generate({
  model: 'gpt-4',
  prompt: 'Hello, how are you?'
});

console.log(response);
```

### Using Multiple Providers

```typescript
import { createMultiProviderKit } from 'agentic-kit';

const kit = createMultiProviderKit();

// Add providers
kit.addProvider('ollama', createOllamaKit('http://localhost:11434'));
kit.addProvider('bradie', createBradieKit({ instanceId: 'your-instance-id', apiKey: 'your-api-key' }));

// Use a specific provider
const response = await kit.generate('ollama', {
  model: 'mistral',
  prompt: 'Hello, how are you?'
});

console.log(response);
```   