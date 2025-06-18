# @agentic-kit/tools

Utility tools for AgenticKit - Git, filesystem, search, and text processing.

## Installation

```bash
npm install @agentic-kit/tools
```

## Usage

```typescript
import { GitTool, FileSystemTool, SearchTool, TextTool } from '@agentic-kit/tools';

// Git operations
const git = new GitTool('./my-repo');
await git.status();
await git.commit('Update files');

// File operations
const fs = new FileSystemTool();
const content = await fs.readFile('./file.txt');

// Search operations
const search = new SearchTool();
const results = await search.searchInDirectory('./src', /TODO/gi);

// Text processing
const text = new TextTool();
const blocks = text.extractCodeBlocks(markdown);
```

## Available Tools

- `GitTool` - Git repository operations
- `FileSystemTool` - File and directory operations
- `SearchTool` - Text search across files
- `TextTool` - Text processing and extraction

## API Reference

Each tool provides methods for common operations in their respective domains.
