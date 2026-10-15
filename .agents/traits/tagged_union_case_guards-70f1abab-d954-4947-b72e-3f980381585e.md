---
id: 70f1abab-d954-4947-b72e-3f980381585e
name: tagged_union_case_guards
when: testing or filtering cases of tagged unions with built-in case guards.
mime: [text/typescript, text/tsx]
---
Use tagged unions’ built-in case guards when testing or filtering cases rather than manually comparing the tag: Array.filter(TraitExpression.guards.Fail), not Array.filter((value) => value._tag === "Fail").
