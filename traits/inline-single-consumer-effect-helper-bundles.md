---
name: inline-single-consumer-effect-helper-bundles
subject: Effect initialization helpers that return utility objects consumed by a
  single layer implementation.
match: "**/*.{ts,tsx,mts,cts}"
assertion: Define the utilities directly within the consuming layer's
  initialization generator instead of using a separate Effect that constructs
  and returns a helper bundle. Retain a separate helper when it is reused or
  establishes a meaningful resource-lifecycle or abstraction boundary.
purpose: Keep dependencies and implementation logic together without redundant
  initialization, context binding, or intermediate utility objects.
prelude:
  - For each Effect this file exports that builds an object of helpers, find
    whether more than one place uses it.
---

Violation: `const storeHelpers = Effect.gen(function* () { const fs = yield* FileSystem.FileSystem; return { readJson, writeJson } })` yielded only by `layerStore`; define `readJson` and `writeJson` in `layerStore`'s generator.

Not a violation: a layer that yields such a bundle from a helper that another layer also yields, such as `Registry.make(...)` consumed by both `layerParsers` and `layerFormatters`. Count consumers across files; the consuming layer is judged by how many layers use the helper, not by the fact that it destructures one.
