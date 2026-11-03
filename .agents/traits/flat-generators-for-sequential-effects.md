---
name: flat-generators-for-sequential-effects
subject: Sequential Effect operations that retrieve services and perform dependent work.
requirement: Prefer a single Effect.gen that yields required services directly
  over wrapping an inner generator in flatMap solely to access those services.
  Apply operation-wide transformations outside the generator, using pipe for
  Effect values and Effect.fn transformation arguments for functions. Retain
  nesting when it establishes a distinct scope, timeout, resource lifetime, or
  other necessary execution boundary.
purpose: Make dependency access and effect sequencing explicit without
  unnecessary generator nesting.
---
