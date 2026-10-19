---
name: centralized-domain-schema-variants
subject: Domain models with multiple related boundary shapes.
requirement: When a domain model needs multiple related boundary shapes, declare
  shared fields and per-variant availability or encoding policies once with
  Effect VariantSchema, or Model when its standard variants fit. Expose named
  schemas from the domain module and reuse them instead of repeatedly spreading,
  picking, or omitting schema fields at call sites. Introduce variants only for
  genuinely different existing contracts, not speculative insert/update shapes.
---
```diff
-const Stored = S.Struct({ name: S.String, body: S.String })
-const Header = S.Struct({ name: S.String })
+const fields = variants.Struct({ name: S.String, body: pipe(S.String, variants.FieldOnly(["stored"])) })
+const Stored = variants.extract(fields, "stored")
+const Header = variants.extract(fields, "header")
```
