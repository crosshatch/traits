---
id: 9b5fb86c-caf6-4273-82f1-af78c95ff558
name: type_alias_before_schema
when: extracting a static type from an Effect schema.
mime: [text/typescript, text/tsx]
---
When extracting a schema’s static type, place the type alias immediately above the schema definition: `export type User = typeof User.Type` directly before `export const User = S.Struct({ id: S.String })`, not after it.
