---
id: 7a3f79b7-db7e-4165-a011-2385d2361abf
name: effect-predicate-helpers
---

Prefer Effect’s Predicate helpers over equivalent hand-written runtime checks, especially as predicates passed to combinators (e.g., Predicate.isString), when they preserve required semantics, including narrowing. Keep native checks when no suitable helper exists or a helper would change required semantics.
