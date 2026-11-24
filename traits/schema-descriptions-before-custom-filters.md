---
name: schema-descriptions-before-custom-filters
subject: Description annotations on Effect schemas whose last check is a custom
  S.makeFilter filter. Descriptions added with .annotateKey are out of scope, as
  are schemas whose last check is a built-in one such as S.isPattern or
  S.isMaxLength, and transformation schemas such as S.URLFromString or
  S.SemVerFromString.
match: "**/*.{ts,tsx,mts,cts}"
assertion: Call .annotate({ description }) before .check(...) when the check
  ends in a custom S.makeFilter filter. An annotation added after a check
  attaches to that check instead of the schema, and a custom filter has no JSON
  Schema representation, so the description is silently left out of the
  generated JSON Schema. Placing a brand between the check and the annotation
  does not help, and neither does passing the description to S.makeFilter's own
  annotations. Verify that the generated JSON Schema carries the description.
purpose: Keep schema descriptions visible to editors, models, and other
  consumers of generated JSON Schema when a schema needs a custom check.
---

```diff
 before: S.Array(InputRange)
-  .check(S.makeFilter(isAscending))
-  .annotate({ description: "Diff-associated ranges in before-source coordinates." })
+  .annotate({ description: "Diff-associated ranges in before-source coordinates." })
+  .check(S.makeFilter(isAscending))
```

In the installed Effect 4.1.4, the array in the JSON Schema from `S.toJsonSchemaDocument` has no description for the first form and carries it for the second. The same holds for structs and strings:

```ts
// Correct: the struct is described, then checked.
export const InputRange = S.Struct({ start: S.Natural, end: S.Natural })
  .annotate({ description: "An ordered UTF-16 text range." })
  .check(S.makeFilter((range) => range.end >= range.start))
```

Violation: `S.String.check(S.makeFilter(f)).pipe(S.brand("traits/Id")).annotate({ description })`, which exports as `{ "type": "string" }`.

Only the last check matters, because that is what a trailing annotation attaches to. `S.String.check(S.isPattern(/^a/u), S.makeFilter(f)).annotate({ description })` loses its description, while `S.String.check(S.makeFilter(f), S.isPattern(/^a/u)).annotate({ description })` keeps it.

Not a violation: `TraitName`, `S.String.check(isKebabCasePattern, S.isMaxLength(200)).pipe(S.brand("traits/TraitName")).annotate({ description })`. Its checks are built in, so the trailing description is exported.

Not a violation: `range: InputRange.annotateKey({ description })`. A key description is exported whether or not the schema has a custom filter.

Out of scope: `url: S.URLFromString.check(S.makeFilter(isHttp)).annotate({ description })`. The generated JSON Schema describes a transformation's encoded side, so a description on the decoded side is not exported wherever the check is placed. Keep the narrow schema and its description anyway; the description still documents the field in code.
