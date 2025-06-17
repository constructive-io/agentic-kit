# NPM Dependencies Plan for AgenticKit (TypeScript OpenHands)

## Overview

This document outlines the npm packages required for implementing the full AgenticKit platform (TypeScript OpenHands implementation), prioritizing native Node.js capabilities and minimal external dependencies.

## Core Philosophy

- **Native First**: Use Node.js built-in modules wherever possible (fs, path, crypto, etc.)
- **Minimal Dependencies**: Only add external packages when native solutions are insufficient
- **TypeScript Native**: Leverage TypeScript's type system and modern JavaScript features
- **Performance Focused**: Choose lightweight, performant packages
- **Security Conscious**: Avoid packages with known vulnerabilities or excessive dependencies

## Dependencies by Category

### 1. Core Framework & Runtime

#### Essential Dependencies
```json
{
  "typescript": "^5.3.0",
  "@types/node": "^20.0.0"
}
```

#### Native Alternatives Used
- **File System**: `fs/promises` (native)
- **Path Operations**: `path` (native) 
- **Process Management**: `child_process` (native)
- **Streams**: `stream` (native)
- **Events**: `events` (native)
- **Crypto**: `crypto` (native)
- **URL Parsing**: `url` (native)

### 2. HTTP & Networking

#### Minimal Dependencies
```json
{
  "undici": "^6.0.0"
}
```

#### Rationale
- **undici**: Modern, fast HTTP client (Node.js team maintained)
- **Alternative to**: axios, node-fetch (undici is becoming Node.js standard)
- **Native**: `fetch` is now available in Node.js 18+ but undici provides more features

### 3. Web Server & API

#### Essential Dependencies
```json
{
  "fastify": "^4.24.0",
  "@fastify/websocket": "^8.3.0",
  "@fastify/cors": "^8.4.0",
  "@fastify/static": "^6.12.0"
}
```

#### Rationale
- **fastify**: High-performance web framework (faster than Express)
- **WebSocket support**: Real-time agent communication
- **CORS**: Cross-origin resource sharing
- **Static files**: Serve web UI assets

#### Native Alternatives Considered
- **http/https**: Native but too low-level for complex APIs
- **Express**: More popular but slower than Fastify

### 4. Process & Command Execution

#### Minimal Dependencies
```json
{
  "execa": "^8.0.0"
}
```

#### Rationale
- **execa**: Better child_process with proper error handling
- **Alternative to**: Native `child_process` (execa provides better API)

#### Native Alternatives Used
- **Process management**: `process` (native)
- **Environment variables**: `process.env` (native)

### 5. File System & Path Operations

#### No External Dependencies
```json
{}
```

#### Native Solutions
- **File operations**: `fs/promises` (native)
- **Path manipulation**: `path` (native)
- **Directory watching**: `fs.watch` (native)
- **File streaming**: `fs.createReadStream/WriteStream` (native)

### 6. Browser Automation

#### Essential Dependencies
```json
{
  "playwright": "^1.40.0"
}
```

#### Rationale
- **playwright**: Cross-browser automation (Chrome, Firefox, Safari)
- **Alternative to**: puppeteer (playwright supports more browsers)
- **Features**: Screenshots, PDF generation, mobile emulation

### 7. Database & Storage

#### Minimal Dependencies
```json
{
  "better-sqlite3": "^9.2.0"
}
```

#### Rationale
- **better-sqlite3**: Fast, embedded database for state/memory storage
- **Alternative to**: PostgreSQL/MySQL (overkill for agent state)
- **Native**: No built-in database in Node.js

### 8. Configuration & Environment

#### Minimal Dependencies
```json
{
  "zod": "^3.22.0"
}
```

#### Rationale
- **zod**: Runtime type validation for configuration
- **Alternative to**: joi, yup (zod has better TypeScript integration)

#### Native Alternatives Used
- **Environment variables**: `process.env` (native)
- **JSON parsing**: `JSON.parse/stringify` (native)

### 9. Logging & Monitoring

#### Minimal Dependencies
```json
{
  "pino": "^8.17.0"
}
```

#### Rationale
- **pino**: High-performance JSON logger
- **Alternative to**: winston (pino is faster)

#### Native Alternatives Considered
- **console**: Native but limited formatting/levels

### 10. Testing Framework

#### Development Dependencies
```json
{
  "vitest": "^1.0.0",
  "@types/jest": "^29.5.0"
}
```

#### Rationale
- **vitest**: Fast test runner with TypeScript support
- **Alternative to**: jest (vitest is faster and more modern)

### 11. Code Quality & Formatting

#### Development Dependencies
```json
{
  "eslint": "^8.55.0",
  "@typescript-eslint/eslint-plugin": "^6.14.0",
  "@typescript-eslint/parser": "^6.14.0",
  "prettier": "^3.1.0"
}
```

### 12. Build & Development Tools

#### Development Dependencies
```json
{
  "tsx": "^4.6.0",
  "rimraf": "^5.0.0",
  "copyfiles": "^2.4.1"
}
```

#### Rationale
- **tsx**: TypeScript execution (faster than ts-node)
- **rimraf**: Cross-platform rm -rf
- **copyfiles**: Cross-platform file copying

### 13. Git Operations

#### Minimal Dependencies
```json
{
  "simple-git": "^3.20.0"
}
```

#### Rationale
- **simple-git**: Git operations from Node.js
- **Alternative to**: Native git commands (simple-git provides better API)

### 14. Compression & Archives

#### No External Dependencies
```json
{}
```

#### Native Solutions
- **Gzip**: `zlib` (native)
- **Zip**: Could use native streams or add `yauzl/yazl` if needed

### 15. Cryptography & Security

#### No External Dependencies
```json
{}
```

#### Native Solutions
- **Hashing**: `crypto` (native)
- **Random generation**: `crypto.randomBytes` (native)
- **JWT**: Could implement with native crypto or add `jsonwebtoken` if needed

## Complete Package.json Dependencies

### Production Dependencies
```json
{
  "dependencies": {
    "undici": "^6.0.0",
    "fastify": "^4.24.0",
    "@fastify/websocket": "^8.3.0",
    "@fastify/cors": "^8.4.0",
    "@fastify/static": "^6.12.0",
    "execa": "^8.0.0",
    "playwright": "^1.40.0",
    "better-sqlite3": "^9.2.0",
    "zod": "^3.22.0",
    "pino": "^8.17.0",
    "simple-git": "^3.20.0"
  }
}
```

### Development Dependencies
```json
{
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "vitest": "^1.0.0",
    "@types/jest": "^29.5.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "prettier": "^3.1.0",
    "tsx": "^4.6.0",
    "rimraf": "^5.0.0",
    "copyfiles": "^2.4.1"
  }
}
```

## Package-Specific Dependencies

### Core Package
```json
{
  "dependencies": {
    "zod": "^3.22.0",
    "pino": "^8.17.0"
  }
}
```

### Runtime Package
```json
{
  "dependencies": {
    "execa": "^8.0.0",
    "playwright": "^1.40.0"
  }
}
```

### Server Package
```json
{
  "dependencies": {
    "fastify": "^4.24.0",
    "@fastify/websocket": "^8.3.0",
    "@fastify/cors": "^8.4.0",
    "@fastify/static": "^6.12.0"
  }
}
```

### LLM Package
```json
{
  "dependencies": {
    "undici": "^6.0.0"
  }
}
```

### Memory Package
```json
{
  "dependencies": {
    "better-sqlite3": "^9.2.0"
  }
}
```

### Tools Package
```json
{
  "dependencies": {
    "simple-git": "^3.20.0"
  }
}
```

## Native Node.js Modules Used

### File System & I/O
- `fs/promises` - Async file operations
- `fs` - Sync file operations and streams
- `path` - Path manipulation
- `stream` - Stream processing
- `readline` - Line-by-line reading

### Process & System
- `child_process` - Process spawning (enhanced by execa)
- `process` - Process information and control
- `os` - Operating system utilities
- `cluster` - Multi-process scaling

### Networking & HTTP
- `http/https` - Basic HTTP (enhanced by fastify)
- `net` - TCP networking
- `dns` - DNS resolution
- `url` - URL parsing

### Utilities
- `crypto` - Cryptographic functions
- `util` - Utility functions
- `events` - Event emitter
- `buffer` - Binary data handling
- `zlib` - Compression

### Timing & Async
- `timers/promises` - Promise-based timers
- `async_hooks` - Async context tracking

## Dependency Justification

### Why These Packages?

1. **Performance**: All chosen packages are known for high performance
2. **Maintenance**: All packages are actively maintained with regular updates
3. **TypeScript Support**: All packages have excellent TypeScript support
4. **Security**: All packages have good security track records
5. **Size**: Minimal bundle size impact
6. **Compatibility**: Cross-platform compatibility

### Packages Deliberately Avoided

1. **lodash**: Native JavaScript methods are sufficient
2. **moment**: Native Date and Intl APIs are sufficient
3. **axios**: undici is more modern and performant
4. **express**: fastify is faster and more modern
5. **winston**: pino is faster
6. **jest**: vitest is faster and more modern
7. **webpack/rollup**: Native TypeScript compilation is sufficient

## Bundle Size Analysis

### Total Production Dependencies: ~11 packages
### Estimated Bundle Size: ~50-100MB (including Playwright browsers)
### Runtime Memory: ~50-200MB depending on usage

## Security Considerations

1. **Regular Updates**: All dependencies will be updated regularly
2. **Vulnerability Scanning**: Automated security scanning in CI
3. **Minimal Attack Surface**: Fewer dependencies = fewer vulnerabilities
4. **Native Crypto**: Using Node.js native crypto instead of external libraries
5. **Sandboxing**: Process isolation for code execution

## Performance Characteristics

1. **Startup Time**: < 2 seconds (minimal dependencies)
2. **Memory Usage**: < 500MB for typical workloads
3. **HTTP Throughput**: > 10,000 req/sec (fastify)
4. **File I/O**: Native performance (no overhead)
5. **Process Spawning**: Optimized with execa

## Alternative Packages Considered

### HTTP Clients
- **axios**: Popular but heavier than undici
- **node-fetch**: Being deprecated in favor of native fetch
- **got**: Good but undici is becoming standard

### Web Frameworks
- **express**: Most popular but slower than fastify
- **koa**: Good but fastify has better TypeScript support
- **hapi**: Feature-rich but heavier

### Process Management
- **cross-spawn**: Good but execa includes it and more
- **shelljs**: Too high-level, prefer native + execa

### Database
- **sqlite3**: Slower than better-sqlite3
- **duckdb**: Overkill for our use case
- **leveldb**: Good but SQLite is more familiar

## Conclusion

This dependency list prioritizes:
1. **Native Node.js capabilities** wherever possible
2. **Minimal external dependencies** for security and performance
3. **Modern, well-maintained packages** with TypeScript support
4. **High-performance solutions** suitable for production use

Total production dependencies: **11 packages**
Total development dependencies: **11 packages**

This is significantly fewer dependencies than typical Node.js projects while maintaining full functionality equivalent to OpenHands.
