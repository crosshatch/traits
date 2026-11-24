---
name: tagged-error-classes-for-schema-backed-failures
subject: "Custom schema-backed values used as Effect failures: yielded,
  returned, or passed to Effect.fail as the error. Tagged structs and unions
  that are only stored as data in results or reports are out of scope, even when
  they describe a failure."
match: "**/*.{ts,tsx,mts,cts}"
assertion: Define custom schema-backed failures with Schema.TaggedError classes
  rather than Schema.TaggedStruct when they represent actual errors. Return or
  yield their effectable instances directly rather than wrapping them in
  Effect.fail. Keep tagged structs for data-only result variants.
purpose: Give failures native Error behavior, schema support, and direct Effect
  integration.
---

Out of scope: Report/DiagnosticOrigin.ts, a `S.TaggedUnion` recording which extension stage failed. It is stored in `Diagnostic.origin` and never placed in an error channel.
