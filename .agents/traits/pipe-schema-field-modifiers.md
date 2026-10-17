---
name: pipe-schema-field-modifiers
when: applying optional, nullable, or similar modifiers to Effect Schema fields.
mime: [text/typescript, text/tsx]
---

```diff
-location: S.optional(SourceLocation)
+location: SourceLocation.pipe(S.optional)
```

---
For optional or nullable Effect Schema fields, apply the field modifier using the schema’s own .pipe method, even for a single modifier: location: SourceLocation.pipe(S.optional), not location: S.optional(SourceLocation). Apply the same rule to S.optionalKey, S.NullOr, S.UndefinedOr, and similar field modifiers. This schema-field convention requires .pipe even when there is no chain of successive transformations.
