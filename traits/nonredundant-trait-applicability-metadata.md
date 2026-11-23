---
name: nonredundant-trait-applicability-metadata
subject: The subject field of trait files, whose opening sentence says what to
  assess and whose later sentences state scope and exceptions.
match: "**/*.md"
assertion: Keep the parts of a trait's subject complementary. The opening
  sentence identifies what to assess; later sentences add circumstances and
  independent exceptions without repeating the opening sentence or restating its
  negation. Omit scope sentences that add no restriction, including a
  restriction to kinds of file, which belongs in the match field.
purpose: Make applicability decisions easier by separating the subject from
  genuinely additional scope and exceptions.
---

```diff
-subject: Imports from local project modules. Not imports from external packages.
+subject: Imports from local project modules.
```

```diff
-subject: Retry behavior in Effect programs. In TypeScript or TSX files.
+subject: Retry behavior in Effect programs.
+match: "**/*.{ts,tsx,mts,cts}"
```

Not a violation: `subject: Utility choices beyond inline comparisons. Exception: When every native choice is required to preserve behavior.` The exception adds scope the opening sentence does not state. Overlap between a subject and its assertion is not judged by this rule.
