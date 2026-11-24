---
name: pipe-schema-field-modifiers
subject: Optional, nullable, and similar modifiers on Effect Schema fields.
match: "**/*.{ts,tsx,mts,cts}"
assertion: "For optional or nullable Effect Schema fields, apply the field
  modifier using the schema’s own .pipe method, even for a single modifier:
  location: SourceLocation.pipe(S.optionalKey), not location:
  S.optionalKey(SourceLocation). Apply the same rule to S.optional, S.NullOr,
  S.UndefinedOr, and similar field modifiers. This schema-field convention
  requires .pipe even when there is no chain of successive transformations."
purpose: Keep a field's base schema and its presence or nullability policy
  readable in a consistent order.
---

```diff
-location: S.optionalKey(SourceLocation)
+location: SourceLocation.pipe(S.optionalKey)
```
