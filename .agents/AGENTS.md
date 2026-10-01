# Project Guidelines

All paths below are relative to the repository root.

## Workspace

- `crosshatch/`: published library.
- `crosshatch.dev/`: Cloudflare application using Alchemy, Workers, Durable Objects, and Drizzle.
- Use pnpm and Node-compatible tooling; do not introduce Bun APIs.
- Use `.agents/skills/verify/SKILL.md` for verification commands and test guidance. App integration tests deploy and target live Cloudflare deployments.

## Reference Repositories

- Treat submodules under `repos/` as read-only unless explicitly asked to modify them.
- Prefer relevant source, tests, and examples over guesses or web searches.
- Import normal package dependencies, never vendored source.
- For Effect patterns and API design, consult `repos/Effect-TS/effect/`.
- For Alchemy application and deployment patterns, consult `repos/alchemy-run/alchemy-effect/examples/`.

## Effect

- Library code under `crosshatch/` must use `Effect.fnUntraced` instead of `Effect.fn`.
- Aside from in library code (`crosshatch/`), always use `Effect.fn` with a concise span name: `Effect.fn("<name>")(function* () { ... })` rather than `Effect.fn(function* () { ... })`.
- Prefer `Effect.fn` / `Effect.fnUntraced` over functions that only return `Effect.gen`, including callbacks such as `items.map(Effect.fn("processItem")(function* (item) { ... }))`.
- Apply transformations through additional function arguments to the wrapper. These receive the effect and the original arguments, so argument-dependent services do not require an outer arrow function:

  ```ts
  const process = Effect.fn("process")(
    function* (item: Item) { /* ... */ },
    (effect, item) => Effect.provideService(effect, TheService, item)
  )
  ```

  Use the same form with `Effect.fnUntraced` in library code, without a span name.
- An outer callback returning `Effect.gen(...).pipe(...)` is appropriate when it needs to capture callback-local values for the pipeline, e.g. `(item) => Effect.gen(function* () { ... }).pipe(Effect.provide(outerThing))`. Merely referencing an outer value does not require this exception: prefer a wrapper transformation when it can capture that value directly.

## Layer Naming

- When a module's primary layer represents its core service, export it as `layer`.
- Include the service or role only when the module exports multiple layers and `layer` alone would not identify what each provides.
- Add implementation or backend qualifiers after the service or role.
- When a layer is constructed from a particular input source, append `From<InputSource>`.

```ts
// Module's core service
layer
layerFromConfig
layerFromEnv

// Multiple services or roles in one module
layerFoo
layerFooFromConfig
layerFooFromEnv

layerStoreRedis
layerStoreRedisFromConfig
```

General forms:

```text
layer[FromInputSource]
layer<ServiceOrRole>[Implementation][FromInputSource]
```

Avoid `XLive`, `XLayer`, `layerFooConfig`, and `layerFooEnv`.

## Configuration

Keep configuration minimal and deliberate: verify defaults, remove duplication, and avoid speculative abstractions. Use `.agents/skills/prune/SKILL.md` when auditing configuration.
