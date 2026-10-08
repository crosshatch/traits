Use the Effect alternative for each Node API:

| Node API | Effect alternative |
| --- | --- |
| `node:fs`, `node:fs/promises` | `FileSystem` service |
| `node:path` | `Path` service |
| `process.cwd()` | `path.resolve()` using the injected `Path` service |
| `node:child_process` | `effect/process`: define processes with `ChildProcess` and run them through `ChildProcessSpawner` |

Access these services through Effect’s dependency injection so filesystem, path, and process behavior remain testable and platform-independent: `const fs = yield* FileSystem.FileSystem; yield* fs.readFileString(file)`, not `yield* Effect.promise(() => readFile(file, "utf8"))` using `node:fs/promises`.
