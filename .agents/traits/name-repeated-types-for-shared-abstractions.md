---
name: name-repeated-types-for-shared-abstractions
subject: Repeated TypeScript type expressions representing the same abstraction.
assertion: Extract a descriptive named type and reuse it when multiple
  declarations repeat the same type expression for the same abstraction.
  Preserve generic parameters and their relationships. Two repetitions of a
  non-trivial type expression, such as a full function signature, are enough.
  Interchangeable roles in one contract, such as primary and fallback, before
  and after, or sibling handlers, represent the same abstraction. Do not unify
  types solely because their current structure matches when they represent
  independently evolving concepts.
purpose: Make shared contracts explicit and avoid duplicated type signatures
  drifting apart.
---
For example, define EffectTransformer once for a generic Effect-to-Effect transformation and use it for both asDecision and asFileRead, rather than repeating the full generic call signature.
```diff
-interface Sources<K, V> { readonly primary: (keys: ReadonlyArray<K>) => Effect.Effect<Map<K, V>>; readonly fallback: (keys: ReadonlyArray<K>) => Effect.Effect<Map<K, V>> }
+type Loader<K, V> = (keys: ReadonlyArray<K>) => Effect.Effect<Map<K, V>>
+interface Sources<K, V> { readonly primary: Loader<K, V>; readonly fallback: Loader<K, V> }
```
