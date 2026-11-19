---
name: nonredundant-trait-applicability-metadata
subject: The subject field of trait files, whose opening sentence says what to
  assess and whose later sentences state scope and exceptions.
assertion: Keep the parts of a trait's subject complementary. The opening
  sentence identifies what to assess; later sentences add circumstances,
  language or file restrictions, and independent exceptions without repeating
  the opening sentence or restating its negation. Omit scope sentences that add
  no restriction.
purpose: Make applicability decisions easier by separating the subject from
  genuinely additional scope and exceptions.
---

```diff
-subject: Imports from local project modules. Not imports from external packages.
+subject: Imports from local project modules.
```

Not a violation: `subject: Utility choices beyond inline comparisons. In TypeScript or TSX files. Exception: When every native choice is required to preserve behavior.` The file restriction and the exception add scope the opening sentence does not state. Overlap between a subject and its assertion is not judged by this rule.
