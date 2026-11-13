---
name: flat-generators-for-sequential-effects
subject: Sequential Effect operations that retrieve services and perform dependent work.
assertion: Prefer a single Effect.gen that yields required services directly
  over wrapping an inner generator in flatMap solely to access those services.
  Apply operation-wide transformations outside the generator, using pipe for
  Effect values and Effect.fn transformation arguments for functions. Retain
  nesting when it establishes a distinct scope, timeout, resource lifetime,
  service provision (providing services or layers built from values yielded
  earlier in the outer generator), deferred execution (an inner effect
  returned as a value to run later, such as an extension's per-input execution
  returned from its setup), or other necessary execution boundary.
purpose: Make dependency access and effect sequencing explicit without
  unnecessary generator nesting.
---

Not a violation: setup runs once and returns the per-input effect, which the host runs for each input.

```ts
export default Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  return Effect.gen(function* () {
    const { input } = yield* Enrichment.EnrichmentContext
    return yield* describe(fs, input)
  })
})
```
