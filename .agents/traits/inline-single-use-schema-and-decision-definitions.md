---
name: inline-single-use-schema-and-decision-definitions
subject: Named schemas, schema transcoders, and effect/ai Decision.make definitions,
  including exported ones. In TypeScript or TSX files. Excludes schema error
  classes, Tool.make tool definitions, other make constructors such as
  DecisionPolicy.make, and named schemas for collection element types (see
  named-collection-element-types).
assertion: "Prefer inlining single-use schemas, schema transcoder definitions, and
  lightweight Decision.make definitions at their call sites instead of adding
  separate constants and names: DecisionModel.decide(Decision.make({ input:
  S.Struct({ text: S.String }), decisions: { ... } }), options). A definition is
  single-use when exactly one place in the codebase uses it, including an
  exported definition whose only use is in one other file; inline it there. Uses
  in other files, when supplied as context, decide this. Re-exports are not
  uses, and a definition with no uses is unused rather than single-use. Its
  inferred type alias declaration (export type X = typeof X.Type) is not a use,
  but each reference to that alias,
  in the same file or another, is: a value used once and its alias used once,
  such as to type a parameter, are two uses. Out of scope are definitions that are public
  API: exported by a package entry point directly or through any chain of
  re-exports. Extract definitions when reused, when needed for readability, when
  the only use is inside a callback or loop body that would rebuild the
  definition per item, or when profiling shows meaningful construction overhead."
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

Not a violation: `const Heading = S.TemplateLiteralParser(["## ", Version])` whose only use is `S.decodeUnknownOption(Heading)` inside an `Array.reduce` callback over lines; inlined, it would be rebuilt for every line. Also not a violation: `const Kind = S.Literals(["Directory", "File"])` used once as a struct field schema, with `type Kind = typeof Kind.Type` typing a function parameter in the same file.
