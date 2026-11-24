---
name: effect-platform-services
subject: "Filesystem, path, working-directory, and child-process access.
  Excludes build-tool configuration files such as vite.config.ts, whose plugin
  hooks follow the tool's Promise contract (see native-promises-in-build-hooks).
  Exception: when all native Node API usage under assessment is confined to
  synchronous tooling boundaries and is needed to preserve the framework's
  synchronous execution contract."
match: "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"
assertion: "Use the Effect alternative for Node APIs in ordinary application
  code: node:fs and node:fs/promises use the FileSystem service; node:path uses
  the Path service; process.cwd() uses path.resolve() on the injected Path
  service; node:child_process uses effect/process with ChildProcess and
  ChildProcessSpawner. Access these services through Effect dependency injection
  so behavior remains testable and platform-independent. At synchronous tooling
  boundaries, such as Oxlint rule callbacks, native synchronous Node APIs may
  remain when needed to preserve the framework’s synchronous execution contract.
  Keep this exception confined to the tooling boundary rather than using it to
  bypass Effect in application code. Native usage is also allowed when the
  needed capability is not exposed by the Effect service (e.g. OS file locking
  needs a native file descriptor that FileSystem.File does not expose); keep
  such native usage minimal, lazily loaded, wrapped in Effect, and documented at
  the use site, and use the Effect services for everything else. Undocumented
  native usage, or native usage for capabilities the Effect services provide,
  remains a violation."
purpose: Make platform dependencies injectable, testable, and portable without
  breaking synchronous tooling contracts.
---

```diff
-const text = await fs.readFile(file, "utf8")
+const fs = yield* FileSystem.FileSystem
+const text = yield* fs.readFileString(file)
```

Allowed: a capability the Effect service does not expose, minimal, lazy, wrapped, and documented.

```ts
// Effect FileSystem does not expose the native descriptor required by the locking API.
const native = Effect.tryPromise(() => import("node:fs/promises")).pipe(Effect.cached)
const handle = yield* Effect.tryPromise(() => open(lock, "r+")) // only for handle.fd
yield* fs.makeDirectory(dataDirectory, { recursive: true }) // everything else via FileSystem
```

Violation: native usage for something FileSystem provides (`await readFile(path, "utf8")`, `mkdir(...)`), or native usage without a use-site comment explaining the missing capability.

Out of scope: `await readFile(new URL("../SETUP.md", import.meta.url), "utf8")` in a plugin hook of vite.config.ts, which is build-tool configuration rather than application code.
