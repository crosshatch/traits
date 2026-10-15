---
id: 8e310fce-e255-426c-8c51-92e45dffd9b3
name: schema_tagged_union_case_factories
when: constructing members of Effect Schema tagged unions.
mime: [text/typescript, text/tsx]
---
Construct instances of Effect Schema tagged unions with their case-specific factories, not manually tagged object literals: Union.cases.Fail.make({ reason }), not { _tag: "Fail", reason }.
