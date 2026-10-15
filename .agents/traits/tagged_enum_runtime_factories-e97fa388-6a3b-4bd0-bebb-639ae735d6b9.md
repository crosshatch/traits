---
id: e97fa388-6a3b-4bd0-bebb-639ae735d6b9
name: tagged_enum_runtime_factories
when: declaring an Effect Data.TaggedEnum type alias.
mime: [text/typescript, text/tsx]
---
Every Effect Data.TaggedEnum type alias must be paired with a same-named runtime Data.taggedEnum factory, exposing both the type and value under one name: export type Outcome = Data.TaggedEnum<{ Pass: {}; Fail: { reason: string } }>; export const Outcome = Data.taggedEnum<Outcome>(). This applies to Data.TaggedEnum declarations, independently of Schema.TaggedUnion construction rules.
