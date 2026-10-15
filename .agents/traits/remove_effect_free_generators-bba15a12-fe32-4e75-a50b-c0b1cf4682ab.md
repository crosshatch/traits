---
id: bba15a12-fe32-4e75-a50b-c0b1cf4682ab
name: remove_effect_free_generators
when: introducing or reviewing Effect.gen wrappers and Layer construction.
mime:
  - text/typescript
  - text/tsx
skip: When every Effect.gen wrapper under assessment sequences effectful work
  rather than merely returning an existing value, Effect, or Layer.
---
Remove unnecessary Effect.gen and Effect.fn generator wrappers: return an existing value, Effect, or Layer directly when the generator merely returns it or only yields a single existing Effect pipeline. A lone yield or return yield does not justify a generator. Retain generators that sequence multiple effectful steps. This rule concerns whether a generator is necessary; Promise adapters, parameterless operation exports, tracing, and transformation-chain layout are separate concerns.
