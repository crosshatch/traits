---
name: schema-parsers-for-structured-documents
subject: Parsing of structured domain documents.
requirement: Prefer Effect Schema parsers for structured domain documents when
  their string segments can be modeled declaratively. Decode typed segments with
  decodeEffect rather than manually matching regex captures, checking match
  positions, and slicing strings. Preserve document boundaries, untouched
  content, and meaningful domain-error mappings.
---
```diff
-const parts = /^name:(.*)$/.exec(text)
-const name = parts?.[1]
+const [, name] = yield* pipe(text, S.decodeEffect(S.String.pipe(S.decodeTo(S.TemplateLiteralParser(["name:", S.String])))))
```
