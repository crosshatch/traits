---
name: map-final-effect-transformations-in-pipeline
---
When an Effect result is bound only to apply a final pure transformation and immediately return it, keep that transformation in the Effect pipeline with Effect.map and return the composed Effect directly (or return yield it inside a generator), rather than introducing a temporary result binding.
