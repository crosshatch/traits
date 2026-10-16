---
id: 33fc0681-e97c-4211-b65e-3d358a3dcd41
name: plain-framework-hooks-in-build-config
---

In build-tool configuration files such as vite.config.ts, write plugin hooks and other framework callbacks with plain async/await and Promises. Do not wrap them in Effect.gen or Effect.fn, or add Effect.withSpan, only to run them immediately with Effect.runPromise: the framework's Promise contract is the boundary and nothing collects those spans. Effect conventions, including spans, still apply to application and library code.
