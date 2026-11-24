---
name: native-typescript-benchmark-tooling
subject: Project-owned tooling that measures the runtime performance (time,
  throughput, or memory) of code, and its command-line entry points, in projects
  that already have a project task CLI and support running TypeScript directly
  in Node. Not scripts that measure model or trait-checking accuracy, and not
  documentation that only describes benchmarks.
assertion: Write benchmark tooling in TypeScript runnable directly by the
  supported Node runtime, and register user-facing benchmark commands as
  commands or subcommands of the existing project task CLI, using an
  intermediate benchmark command group when appropriate. Keep isolated worker
  processes where needed for valid measurements.
purpose: Keep benchmarks type-checked and discoverable alongside other project
  tasks without requiring a separate compilation step.
---
