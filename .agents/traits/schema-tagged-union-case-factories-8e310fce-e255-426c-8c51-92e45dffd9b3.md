---
id: 8e310fce-e255-426c-8c51-92e45dffd9b3
name: schema-tagged-union-case-factories
when: constructing values owned by Effect Schema.
mime: [text/typescript, text/tsx]
---
When constructing a value owned by an Effect Schema, prefer the schema’s factory when available, such as Discovery.make({ ... }), rather than a plain object with a type annotation or assertion. For tagged unions, use the case-specific factory, such as Union.cases.Fail.make({ reason }), instead of manually tagged objects. Continue to decode untrusted input rather than using construction factories as a substitute for decoding.
