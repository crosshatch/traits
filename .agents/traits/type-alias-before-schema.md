---
name: type-alias-before-schema
when: extracting a static type from an Effect schema.
mime: [text/typescript, text/tsx]
---
When extracting a schema’s static type, place the type alias immediately above the schema definition: `export type User = typeof User.Type` directly before `export const User = S.Struct({ id: S.String })`, not after it.
