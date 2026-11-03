---
name: whole-operation-operational-error-boundaries
subject: Effect operations intentionally exposing an operation-specific error
  for recovery or a meaningful external boundary.
requirement: Translate every recoverable failure belonging to the operation,
  including encoding and filesystem failures, into its operation-specific error,
  preserving actionable context and the original cause where safe. Place the
  translation around the whole operation rather than only its final step, while
  leaving caller-owned operation errors outside unrelated wrappers and
  preserving genuine internal invariant violations as defects.
applicability: Applies when an operation intentionally provides an
  operation-specific error contract; it does not require introducing a custom
  wrapper where existing errors suffice.
purpose: Give callers a consistent recoverable error contract across every
  operational stage without obscuring unrelated failures.
---
The boundary covers failures belonging to the operation, not every failure from arbitrary caller-supplied work.