import { Schema as S } from "effect"

const TokenCount = S.Finite.check(S.isGreaterThanOrEqualTo(0))

/** Deterministic evaluation provenance, without timestamps, hosts, or absolute paths. */
export type Run = typeof Run.Type
export const Run = S.Struct({
  /** Distinct, sorted model identifiers reported by assessment responses; empty when none were reported. */
  models: S.Array(S.NonEmptyString).check(S.isUnique()).annotate({
    description: "Distinct, sorted model identifiers reported by assessment responses; empty when none were reported."
  }),
  /** Token totals across received assessment responses; a total is omitted when any response did not report it. */
  usage: S.Struct({
    /** Total input tokens. */
    inputTokens: TokenCount.annotateKey({ description: "Total input tokens." }).pipe(S.optionalKey),
    /** Total output tokens. */
    outputTokens: TokenCount.annotateKey({ description: "Total output tokens." }).pipe(S.optionalKey)
  }).annotateKey({
    description:
      "Token totals across received assessment responses; a total is omitted when any response did not report it."
  })
}).annotate({ description: "Deterministic evaluation provenance, without timestamps, hosts, or absolute paths." })
