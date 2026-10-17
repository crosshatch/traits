---
name: explicit-undefined-in-optional-properties
when: declaring optional properties.
mime: [text/typescript, text/tsx]
skip: When every optional property under assessment intentionally permits omission but disallows explicitly passing undefined.
---

```diff
-readonly copyable?: boolean
+readonly copyable?: boolean | undefined
```

---
For TypeScript optional properties, explicitly include undefined in the property type by default: readonly copyable?: boolean | undefined, not readonly copyable?: boolean. Omit the undefined union only when the API intentionally disallows explicitly passing undefined while still permitting omission.
