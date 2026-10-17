---
name: schema-decoding-defaults-for-configuration
when: defining, decoding, or consuming schema-backed configuration with optional defaults.
mime: [text/typescript, text/tsx]
---

```diff
-const limit = config.limit ?? 10
+// Decode with a default once, then read config.limit directly.
+limit: S.Int.pipe(S.withDecodingDefault(() => 10))
```

---
For schema-decoded configuration, express optional-field defaults with Effect Schema decoding defaults rather than fallback expressions at consumption sites. Decode imported configuration with S.decodeUnknownEffect, and expose the schema’s Encoded type for caller-authored configuration so defaulted fields remain optional.
