---
id: fc796941-25f9-428c-aa03-e76b41ef3648
name: schema-parsers-for-structured-documents
---
Prefer Effect Schema parsers for structured domain documents when their string segments can be modeled declaratively. Decode typed segments with decodeEffect rather than manually matching regex captures, checking match positions, and slicing strings. Preserve document boundaries, untouched content, and meaningful domain-error mappings.