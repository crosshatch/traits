---
name: provide-layer-arrays-directly
subject: Providing multiple independent layers to an Effect.
requirement: Use Effect.provide([layerA, layerB, ...]) instead of
  Effect.provide(Layer.mergeAll(layerA, layerB, ...)) when merging only to
  supply those layers to that Effect. Retain explicit layer composition when the
  merged layer is reused or further composition is necessary.
purpose: Avoid redundant layer-merging scaffolding while preserving dependency
  composition semantics.
---
