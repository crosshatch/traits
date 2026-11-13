---
name: provide-layer-arrays-directly
subject: Calls to Effect.provide or Layer.provide that supply multiple layers.
  Layers passed to other APIs, such as a framework's providers option, are out
  of scope.
assertion: Use Effect.provide([layerA, layerB, ...]) or Layer.provide([layerA,
  layerB, ...]) instead of Effect.provide(Layer.mergeAll(layerA, layerB, ...))
  or Layer.provide(Layer.mergeAll(...)), or the same with Layer.merge(a, b),
  when merging only to supply those layers. Retain explicit layer composition when the merged layer is reused or
  further composition is necessary, such as Layer.mergeAll(a, b).pipe(
  Layer.provideMerge(c)) where a or b require services c provides; an array
  would not feed c into them.
purpose: Avoid redundant layer-merging scaffolding while preserving dependency
  composition semantics.
---
