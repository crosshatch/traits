---
name: schema-tagged-union-case-factories
when: constructing members of Effect Schema tagged unions.
mime: [text/typescript, text/tsx]
---

```diff
-const outcome = { _tag: "Fail", reason }
+const outcome = Outcome.cases.Fail.make({ reason })
```

---
Construct instances of Effect Schema tagged unions with their case-specific factories, not manually tagged object literals: Union.cases.Fail.make({ reason }), not { _tag: "Fail", reason }.
