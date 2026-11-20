---
name: direct-property-access-in-parameters
subject: Parameters of functions, arrow callbacks, and generators, in
  TypeScript, TSX, JavaScript, or JSX files.
assertion: "Use direct property access rather than object destructuring in
  function parameters, including arrow callbacks, ordinary functions, and
  generator/Effect handlers: `(v) => v.id`, not `({ id }) => id`; `function*
  (params) { yield* check(params.files) }`, not `function* ({ files }) { yield*
  check(files) }`. This applies regardless of the function body's complexity,
  not only to property selectors. Local destructuring inside a function body is
  unaffected."
purpose: Keep parameter identity and property provenance visible throughout
  function bodies.
---

```diff
-const names = Array.map(items, ({ name }) => name)
+const names = Array.map(items, (item) => item.name)
```

Violation: a callback that destructures a property only to forward it, such as `Effect.mapError(({ cause }) => SaveError.make({ cause }))`; write `Effect.mapError((error) => SaveError.make({ cause: error.cause }))`.

Not a violation: array destructuring of a tuple parameter, such as `([name, total]) => name + total` over `Record.toEntries(totals)`; positions have no property names to keep visible. Destructuring in a `for...of` head is not a parameter either.
