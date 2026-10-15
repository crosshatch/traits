---
id: 8c9c7459-12e5-4976-9fd5-ffdf5c0c05f5
name: native_inline_checks_and_direct_effect_predicates
when: writing inline comparisons, simple runtime checks, or predicate stages in existing pipelines.
mime: [text/typescript, text/tsx]
---
Prefer native syntax for inline comparisons and simple runtime checks, such as `bounds.top <= readingLine` and `value === 0`. Prefer suitable Effect predicate helpers when passed directly as callbacks or curried stages in an existing pipeline, such as `Effect.filterOrFail(Equal.equals(0), onError)` or `Array.filter(values, Predicate.isString)`. Do not introduce wrapper callbacks or extra pipelines solely to use a helper. Retain helpers when native syntax would change required equality semantics or type narrowing; use native expressions when no suitable helper exists or a helper would change required semantics.
