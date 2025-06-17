# Package Migration Plan: Legacy Folder Structure

## Overview

This document outlines the migration plan to move the existing agentic-kit packages into a legacy/ folder to free up the main package namespace for the new AgenticKit (OpenHands TypeScript implementation). The current packages provide LLM adapter functionality and will be preserved under a legacy folder structure.

## Current Package Structure

```
agentic-kit/
├── packages/
│   ├── agentic-kit/           # Main aggregator package (v0.1.2)
│   ├── bradie/                # @agentic-kit/bradie (v0.1.2)
│   └── ollama/                # @agentic-kit/ollama (v0.1.2)
```

## Target Package Structure

```
agentic-kit/
├── legacy/
│   ├── agentic-kit/           # Keep original name (v0.1.2)
│   ├── bradie/                # Keep original name (v0.1.2)
│   └── ollama/                # Keep original name (v0.1.2)
├── packages/
│   ├── core/                  # New: Core AgenticKit framework
│   ├── agents/                # New: Agent implementations
│   ├── runtime/               # New: Runtime environments
│   └── [future AgenticKit packages...]
```

## Migration Strategy

### Phase 1: Folder Structure Migration (Week 1)

#### 1.1 Move Package Directories
```bash
# Create legacy folder and move existing packages
mkdir legacy
mv packages/* legacy/
```

#### 1.2 Package Names Remain Unchanged

**legacy/agentic-kit/package.json:**
- Keep existing name: `agentic-kit`
- Keep existing version: `0.1.2`
- Keep existing dependencies

**legacy/bradie/package.json:**
- Keep existing name: `@agentic-kit/bradie`
- Keep existing version: `0.1.2`

**legacy/ollama/package.json:**
- Keep existing name: `@agentic-kit/ollama`
- Keep existing version: `0.1.2`

#### 1.3 Import Statements Remain Unchanged

**legacy/agentic-kit/src/index.ts:**
```typescript
import { Bradie, BradieState } from '@agentic-kit/bradie';
import OllamaClient, { GenerateInput } from '@agentic-kit/ollama';

// No changes needed - imports remain the same
```

#### 1.4 Update README Files

Create notices about the folder structure change:

**legacy/agentic-kit/README.md:**
```markdown
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
```

### Phase 2: Build Configuration Update (Week 1)

#### 2.1 Update Lerna Configuration

```bash
# Update lerna.json to include legacy packages
# No immediate NPM publishing needed - packages keep same names
```

#### 2.2 No Package Deprecation Needed

Since package names remain unchanged, no NPM deprecation is required. The legacy packages continue to work exactly as before for existing users.

### Phase 3: Documentation Updates (Week 1)

#### 3.1 Update Root README

**README.md:**
```markdown
# AgenticKit

> 🚀 **NEW**: AgenticKit is now a comprehensive AI agent platform - the TypeScript implementation of OpenHands!

## What's New

AgenticKit has evolved from a simple LLM adapter library into a full-featured AI agent platform equivalent to OpenHands, but built in TypeScript.

### Legacy Packages

The original LLM adapter functionality is still available under new package names:

- `agentic-kit` → `@agentic-kit/legacy-adapters`
- `@agentic-kit/bradie` → `@agentic-kit/bradie-legacy`
- `@agentic-kit/ollama` → `@agentic-kit/ollama-legacy`

### New AgenticKit Platform

The new AgenticKit provides:

- 🤖 **Multiple Agent Types**: CodeAct, Browsing, Visual agents
- 🏃 **Runtime Environments**: Docker, Local, Browser, Remote
- 🔧 **Tool Ecosystem**: Extensible tool and plugin system
- 💾 **Memory Management**: Conversation memory and state persistence
- 🌐 **Web Interface**: Real-time web UI and API
- 🔒 **Enterprise Security**: Authentication, authorization, sandboxing

## Quick Start

### Legacy Adapters (Simple LLM Integration)

```bash
npm install @agentic-kit/legacy-adapters
```

```typescript
import { createOllamaKit } from '@agentic-kit/legacy-adapters';

const kit = createOllamaKit('http://localhost:11434');
const response = await kit.generate({ model: 'mistral', prompt: 'Hello' });
```

### New AgenticKit Platform (Full Agent Capabilities)

```bash
npm install agentic-kit
```

```typescript
import { AgenticKit, CodeActAgent } from 'agentic-kit';

const kit = new AgenticKit();
const agent = new CodeActAgent(llm, config);
await kit.runAgent(agent, 'Write a Python script to analyze data');
```

## Migration Guide

See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions.
```

#### 3.2 Create Migration Guide

**MIGRATION.md:**
```markdown
# Migration Guide: Legacy Adapters to AgenticKit

## For Existing Users of agentic-kit

### Quick Migration (Keep Current Functionality)

If you want to keep using the simple LLM adapter functionality:

1. **Update package name:**
   ```bash
   npm uninstall agentic-kit
   npm install @agentic-kit/legacy-adapters
   ```

2. **Update imports:**
   ```typescript
   // Before
   import { createOllamaKit } from 'agentic-kit';
   
   // After  
   import { createOllamaKit } from '@agentic-kit/legacy-adapters';
   ```

3. **No other changes needed** - all APIs remain the same.

### Upgrade to Full AgenticKit Platform

For new capabilities, migrate to the full AgenticKit platform:

1. **Install new AgenticKit:**
   ```bash
   npm install agentic-kit
   ```

2. **Choose your migration path:**

   **Option A: Simple LLM Usage**
   ```typescript
   // Legacy
   import { createOllamaKit } from '@agentic-kit/legacy-adapters';
   const kit = createOllamaKit();
   const response = await kit.generate({ model: 'mistral', prompt: 'Hello' });
   
   // New AgenticKit
   import { LLM } from 'agentic-kit';
   const llm = new LLM({ provider: 'ollama', model: 'mistral' });
   const response = await llm.generate('Hello');
   ```

   **Option B: Full Agent Capabilities**
   ```typescript
   import { AgenticKit, CodeActAgent } from 'agentic-kit';
   
   const kit = new AgenticKit();
   const agent = new CodeActAgent(llm, config);
   
   // Run complex tasks
   await kit.runAgent(agent, 'Analyze this codebase and suggest improvements');
   ```

## Breaking Changes

### Package Names
- `agentic-kit` → `@agentic-kit/legacy-adapters`
- `@agentic-kit/bradie` → `@agentic-kit/bradie-legacy`
- `@agentic-kit/ollama` → `@agentic-kit/ollama-legacy`

### New Main Package
- `agentic-kit` is now the full AgenticKit platform
- Completely different API focused on agents rather than simple LLM calls
- Much more powerful but requires learning new concepts

## Timeline

- **Week 1**: Legacy packages published with new names
- **Week 2**: Old packages deprecated on NPM
- **Week 4**: New AgenticKit platform alpha release
- **Week 8**: New AgenticKit platform stable release

## Support

- **Legacy packages**: Bug fixes only, no new features
- **New AgenticKit**: Active development and new features
- **Migration help**: Open issues for migration assistance
```

### Phase 4: Workspace Preparation (Week 1)

#### 4.1 Update Lerna Configuration

**lerna.json:**
```json
{
  "lerna": "6",
  "conventionalCommits": true,
  "npmClient": "yarn",
  "npmClientArgs": ["--no-lockfile"],
  "packages": [
    "legacy/*",
    "packages/*"
  ],
  "version": "independent",
  "registry": "https://registry.npmjs.org",
  "command": {
    "create": {
      "homepage": "https://github.com/hyperweb-io/agentic-kit",
      "license": "SEE LICENSE IN LICENSE",
      "access": "public"
    },
    "publish": {
      "allowBranch": "main",
      "message": "chore(release): publish"
    }
  }
}
```

#### 4.2 Prepare for New Packages

Create directory structure for new AgenticKit packages:

```
agentic-kit/
├── legacy/
│   ├── agentic-kit/          # Legacy main package
│   ├── bradie/               # Legacy Bradie
│   └── ollama/               # Legacy Ollama
├── packages/
│   ├── core/                 # New: Core AgenticKit framework
│   ├── agents/               # New: Agent implementations  
│   ├── runtime/              # New: Runtime environments
│   ├── events/               # New: Event system
│   ├── llm/                  # New: LLM integration
│   ├── tools/                # New: Tool system
│   ├── memory/               # New: Memory management
│   ├── config/               # New: Configuration system
│   ├── server/               # New: Web server & API
│   └── cli/                  # New: Command line interface
```

## Implementation Checklist

### Week 1: Folder Migration
- [ ] Create legacy/ folder
- [ ] Move existing packages to legacy/
- [ ] Update Lerna configuration to include legacy/*
- [ ] Update root package.json workspaces
- [ ] Update README files with folder structure notices
- [ ] Build and test all packages in new structure
- [ ] Verify existing functionality works unchanged

### Week 1: Documentation
- [ ] Update root README
- [ ] Create folder structure documentation
- [ ] Update package documentation
- [ ] Create changelog entries
- [ ] Update GitHub repository description

### Week 1: Workspace Setup
- [ ] Update Lerna configuration
- [ ] Prepare directory structure for new packages
- [ ] Update CI/CD configurations
- [ ] Update development scripts

## Risk Mitigation

### Breaking Changes
- **Risk**: Folder structure change breaks builds
- **Mitigation**: Update Lerna config to include both legacy/* and packages/*

### Build System Conflicts
- **Risk**: Build tools can't find packages in new location
- **Mitigation**: Update all workspace configurations and test thoroughly

### Documentation Confusion
- **Risk**: Users confused about folder structure
- **Mitigation**: Clear documentation explaining the legacy folder approach

### Development Workflow
- **Risk**: Development workflow disruption during transition
- **Mitigation**: Complete migration in single PR, thorough testing

## Success Metrics

- [ ] All legacy packages successfully moved to legacy/ folder
- [ ] Existing packages continue to work with same names and imports
- [ ] Zero breaking changes for existing users
- [ ] Clear documentation for folder structure
- [ ] Workspace ready for new AgenticKit development

## Timeline Summary

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| 1 | Folder Migration Complete | Moved packages to legacy/, updated configs |
| 2 | Workspace Ready | New packages/ folder ready for AgenticKit |
| 4 | New AgenticKit Alpha | First release of new platform |
| 8 | New AgenticKit Stable | Production-ready release |

This migration plan ensures a smooth transition while preserving full backward compatibility and preparing the workspace for the ambitious new AgenticKit platform development.
