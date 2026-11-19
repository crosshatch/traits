---
name: remove-effect-free-generators
subject: Effect.gen and Effect.fn generator bodies, and Layer construction that
  uses them. In TypeScript or TSX files.
assertion: "Remove unnecessary Effect.gen and Effect.fn generator wrappers:
  return an existing value, Effect, or Layer directly when the generator merely
  returns it or only yields a single existing Effect pipeline. A lone yield or
  return yield does not justify a generator, even when the yielded pipeline
  itself chains several operations. Retain generators that sequence multiple
  effectful steps rather than merely returning an existing value, Effect, or
  Layer. This rule concerns whether a generator is necessary;
  Promise adapters, parameterless operation exports, tracing, and
  transformation-chain layout are separate concerns."
purpose: Make genuine effect sequencing stand out by removing generator
  scaffolding that adds no sequencing behavior.
---
```diff
-const load = Effect.gen(function* () { return yield* read })
+const load = read
```
