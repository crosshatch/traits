---
name: type-alias-before-schema
purpose: Make a schema's static type immediately discoverable beside its runtime definition.
subject: Static type aliases extracted from Effect schemas.
requirement: "When extracting a schema’s static type, place the type alias
  immediately above the schema definition: `export type User = typeof User.Type`
  directly before `export const User = S.Struct({ id: S.String })`, not after
  it."
applicability: |-
  File types or languages: text/typescript, text/tsx.
---
```diff
-export const User = S.Struct({ id: S.String })
 export type User = typeof User.Type
+export const User = S.Struct({ id: S.String })
```
