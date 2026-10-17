---
name: tagged-enum-runtime-factories
when: declaring an Effect Data.TaggedEnum type alias.
mime: [text/typescript, text/tsx]
---

```diff
-type Outcome = Data.TaggedEnum<{ Pass: {}; Fail: { reason: string } }>
+type Outcome = Data.TaggedEnum<{ Pass: {}; Fail: { reason: string } }>
+const Outcome = Data.taggedEnum<Outcome>()
```

---
Every Effect Data.TaggedEnum type alias must be paired with a same-named runtime Data.taggedEnum factory, exposing both the type and value under one name: export type Outcome = Data.TaggedEnum<{ Pass: {}; Fail: { reason: string } }>; export const Outcome = Data.taggedEnum<Outcome>(). This applies to Data.TaggedEnum declarations, independently of Schema.TaggedUnion construction rules.
