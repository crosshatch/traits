---
name: effect-fn-transformations-for-operation-error-boundaries
subject: Whole-operation error translation in reusable Effect functions.
requirement: Use Effect.fn transformation arguments to apply the operation's
  error translation around the whole reusable function.
applicability: Applies to reusable functions intentionally exposing an
  operation-specific error for recovery or a meaningful external boundary.
purpose: Ensure reusable functions apply their recoverable error contract
  consistently across all operational stages.
---
Keep caller-owned operation errors outside unrelated wrappers and genuine internal invariant violations outside recoverable error translation.