---
name: schema-tagged-union-case-factories
subject: Construction of Effect Schema tagged-union members.
requirement: 'Construct instances of Effect Schema tagged unions with their
  case-specific factories, not manually tagged object literals:
  Union.cases.Fail.make({ reason }), not { _tag: "Fail", reason }.'
applicability: |-
  Applies when constructing members of Effect Schema tagged unions.
  File types or languages: text/typescript, text/tsx.
---
```diff
-const outcome = { _tag: "Fail", reason }
+const outcome = Outcome.cases.Fail.make({ reason })
```
