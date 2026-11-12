---
name: inline-single-use-schema-and-decision-definitions
subject: Named schemas, schema transcoders, and Decision.make definitions, including
  exported ones. In TypeScript or TSX files. Excludes schema error classes and
  Tool.make tool definitions.
assertion: "Prefer inlining single-use schemas, schema transcoder definitions, and
  lightweight Decision.make definitions at their call sites instead of adding
  separate constants and names: DecisionModel.decide(Decision.make({ input:
  S.Struct({ text: S.String }), decisions: { ... } }), options). A definition is
  single-use when exactly one place in the codebase uses it, including an
  exported definition whose only use is in one other file; inline it there. Uses
  in other files, when supplied as context, decide this. The definition's own
  inferred type alias (export type X = typeof X.Type) and re-exports are not
  uses, and a definition with no other uses is unused rather than single-use.
  Using its inferred type at a different site from its value counts as another
  use. Out of scope are definitions a barrel or package entry point re-exports,
  by name or with export *, as public API. Extract definitions when reused, when needed for
  readability, or when profiling shows meaningful construction overhead."
purpose: Keep lightweight definitions near their use and avoid names that add
  navigation without a meaningful boundary.
enrichments:
  - "@traits/typescript/references"
---
```diff
-const inputSchema = S.Struct({ text: S.String }) // Used once, no meaningful boundary.
-const input = yield* pipe(value, S.decodeUnknownEffect(inputSchema))
+const input = yield* pipe(value, S.decodeUnknownEffect(S.Struct({ text: S.String })))
```

Not single-use: a field schema shared by several members of one union, such as `const module = WorkspacePath.annotateKey({ description })` used in every case of a `S.TaggedUnion`.
