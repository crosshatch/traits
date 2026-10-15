---
id: 5a12dafc-f94d-4b7b-9f74-d01998864aaf
name: map_final_effect_transformations_in_pipeline
---
When an Effect result is bound only to apply a final pure transformation and immediately return it, keep that transformation in the Effect pipeline with Effect.map and return the composed Effect directly (or return yield it inside a generator), rather than introducing a temporary result binding.