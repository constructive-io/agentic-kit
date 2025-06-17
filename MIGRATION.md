# Migration Guide: Legacy Folder Structure

## Overview

The agentic-kit repository has been restructured to prepare for the new AgenticKit platform (TypeScript OpenHands implementation). The existing LLM adapter packages have been moved to a `legacy/` folder but continue to work exactly as before.

## What Changed

### Repository Structure
```bash
# Before
agentic-kit/
├── packages/
│   ├── agentic-kit/
│   ├── bradie/
│   └── ollama/

# After
agentic-kit/
├── legacy/              # Moved here
│   ├── agentic-kit/
│   ├── bradie/
│   └── ollama/
├── packages/            # Ready for new AgenticKit
```

### What Stayed the Same

✅ **Package Names**: All package names remain unchanged
- `agentic-kit`
- `@agentic-kit/bradie`
- `@agentic-kit/ollama`

✅ **Import Statements**: No changes needed
```typescript
import { createOllamaKit } from 'agentic-kit';
import { Bradie } from '@agentic-kit/bradie';
import OllamaClient from '@agentic-kit/ollama';
```

✅ **API**: All functionality works exactly the same

✅ **NPM Publishing**: Packages continue to be published with same names

## For Existing Users

**No action required!** Your existing code will continue to work without any changes.

## For Contributors

### Development Setup
```bash
git clone https://github.com/hyperweb-io/agentic-kit.git
cd agentic-kit
yarn install

# Build legacy packages
yarn build

# Test legacy packages
yarn test
```

### Package Locations
- Legacy packages are now in `legacy/` folder
- New AgenticKit packages will be in `packages/` folder
- Lerna manages both `legacy/*` and `packages/*`

## Future Plans

### Legacy Packages
- Will continue to be maintained for bug fixes
- No new features planned
- Fully backward compatible

### New AgenticKit Platform
- Complete TypeScript implementation of OpenHands
- Advanced agent capabilities
- Runtime environments
- Tool ecosystem
- Web interface
- Enterprise features

## Timeline

- **Week 1**: Folder migration complete ✅
- **Week 2**: New AgenticKit development begins
- **Week 4**: AgenticKit alpha release
- **Week 8**: AgenticKit stable release

## Support

- **Legacy packages**: Continue to work as before
- **Issues**: Report in GitHub issues
- **Questions**: Use GitHub discussions
- **Migration help**: Open an issue for assistance

## FAQ

**Q: Do I need to change my code?**
A: No, everything works exactly the same.

**Q: Will package names change?**
A: No, package names remain unchanged.

**Q: When will legacy packages be deprecated?**
A: No immediate plans for deprecation. They will be maintained for the foreseeable future.

**Q: How do I use the new AgenticKit?**
A: The new AgenticKit is still in development. Documentation will be available when it's ready.

**Q: Can I contribute to the new AgenticKit?**
A: Yes! See the main README and PLAN.md for details on the new platform development.
