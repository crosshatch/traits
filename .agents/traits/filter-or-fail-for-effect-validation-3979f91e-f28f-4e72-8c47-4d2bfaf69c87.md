---
id: 3979f91e-f28f-4e72-8c47-4d2bfaf69c87
name: filter-or-fail-for-effect-validation
when: validating an Effect result solely to fail on a predicate and otherwise continue.
mime: [text/typescript, text/tsx]
---
When validating an Effect result only to fail on a predicate and otherwise continue, prefer Effect.filterOrFail in the effect’s pipe over yielding into a temporary variable and branching to raise an error. Preserve the existing error type and diagnostic details.
