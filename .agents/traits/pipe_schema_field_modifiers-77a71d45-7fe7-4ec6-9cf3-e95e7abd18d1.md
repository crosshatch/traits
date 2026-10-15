---
id: 77a71d45-7fe7-4ec6-9cf3-e95e7abd18d1
name: pipe_schema_field_modifiers
activation: When applying optional, nullable, or similar modifiers to Effect Schema fields.
mime: [text/typescript, text/tsx]
---
For optional or nullable Effect Schema fields, apply the field modifier using the schema’s own .pipe method, even for a single modifier: location: SourceLocation.pipe(S.optional), not location: S.optional(SourceLocation). Apply the same rule to S.optionalKey, S.NullOr, S.UndefinedOr, and similar field modifiers. This schema-field convention requires .pipe even when there is no chain of successive transformations.
