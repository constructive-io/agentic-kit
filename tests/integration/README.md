# Integration tests

Workspace-level lane that runs in-process integration tests against the kit's
HTTP boundary. Brings up `http.createServer`, exercises real serialization
and `fetch`, with mocked providers.

Empty in Phase 0 — scaffolding only. First tests land with Phase 1.3 (run
serialization helpers) and 1.1 (pause/resume). Run with:

```sh
pnpm test:integration
```

`passWithNoTests` is set, so the script is safe to run while empty.
