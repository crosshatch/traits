---
name: canonical-reusable-schema-descriptions
subject: Description annotations on reusable project-defined Effect schemas that
  carry their own description, and their use as object fields. Built-in
  primitives and checks without a domain description (S.String,
  S.NonEmptyString, S.Natural, S.Finite) are not reusable domain schemas, so
  describing them at a field is allowed.
match: "**/*.{ts,tsx,mts,cts}"
assertion: Describe a reusable value’s intrinsic meaning once with .annotate({
  description }) on its schema. Reuse that schema directly when field semantics
  are unchanged, rather than repeating or replacing its description. Use
  .annotateKey({ description }) for genuinely contextual property documentation.
  Override the schema description at a use site only when intentionally
  replacing its description for that use, preserving relevant constraints and
  semantics. Keep field TSDoc aligned with the inherited or contextual
  description. An inline composite created at the field, such as S.Array(X) or
  S.NonEmptyArray(X), is not a reusable schema; describing it with .annotate is
  allowed when X keeps its canonical description.
purpose: Preserve canonical domain documentation and prevent redundant or less
  informative field annotations from obscuring it.
---

For example, a reusable execution-scope schema can explain each scope and that unrelated work is unaffected; a reason field with those same semantics uses reason: ExecutionScope directly. Property-specific context belongs in annotateKey rather than a replacement annotate description. This complements documentation synchronization by specifying where descriptions belong.

An inline composite such as `S.Array(X)` or `S.NonEmptyArray(X)` created at the field is not a reusable schema; describing it with `.annotate({ description })` is allowed when `X` keeps its canonical description.

```ts
// Allowed: Trait keeps its own description; the inline array is described at the field.
traits: S.NonEmptyArray(Trait).annotate({ description: "Complete trait proposals, one per insight." })
```

Violation: replacing a reusable schema's description at a use site with the same semantics.

```ts
reason: ExecutionScope.annotate({ description: "The scope." }) // use reason: ExecutionScope
```

Allowed, because `S.NonEmptyString` has no description of its own to replace:

```ts
name: S.NonEmptyString.annotate({ description: "The evaluator package name." })
```

`.annotateKey({ description })` never replaces the schema's own description, so it is a violation only when its text merely repeats that description.

```ts
// Allowed: Probability keeps "A finite probability between zero and one, inclusive."; the key says what this probability measures.
pass: Probability.annotateKey({ description: "Probability that the input satisfies the assertion." })

// Violation: the key description only repeats Probability's own. Use pass: Probability
pass: Probability.annotateKey({ description: "A probability between zero and one." })
```
