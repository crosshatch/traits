---
name: optional-keys-for-json-schema-fields
subject: Optional fields in Effect schemas for JSON-facing data models.
requirement: Use S.optionalKey rather than S.optional when a field may be
  omitted but its value must be JSON-serializable. Do not admit explicit
  undefined as a field value; retain optional/undefined semantics for APIs that
  intentionally allow them outside this contract.
purpose: Preserve the distinction between omitted keys and undefined values in
  JSON-facing contracts.
---
```ts
body: TraitBody.pipe(S.optionalKey)
```