---
name: tagged-union-case-guards
subject: Case checks and filtering for tagged unions with built-in guards.
requirement: 'Use tagged unions’ built-in case guards when testing or filtering
  cases rather than manually comparing the tag:
  Array.filter(TraitExpression.guards.Fail), not Array.filter((value) =>
  value._tag === "Fail").'
applicability: |-
  Applies when testing or filtering cases of tagged unions with built-in case guards.
  File types or languages: text/typescript, text/tsx.
---
```diff
-const failures = Array.filter(results, (result) => result._tag === "Fail")
+const failures = Array.filter(results, Outcome.guards.Fail)
```
