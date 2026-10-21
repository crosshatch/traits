---
name: schema-decoding-defaults-for-configuration
purpose: Establish configuration defaults once at decoding so consumers can rely on a consistent resolved value.
subject: Schema-backed configuration with optional defaults.
requirement: For schema-decoded configuration, express optional-field defaults
  with Effect Schema decoding defaults rather than fallback expressions at
  consumption sites. Decode imported configuration with S.decodeUnknownEffect,
  and expose the schema’s Encoded type for caller-authored configuration so
  defaulted fields remain optional.
applicability: |-
  File types or languages: text/typescript, text/tsx.
---
```diff
-const limit = config.limit ?? 10
+// Decode with a default once, then read config.limit directly.
+limit: S.Int.pipe(S.withDecodingDefault(() => 10))
```
