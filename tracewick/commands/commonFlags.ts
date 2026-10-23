import { DateTime, Option, Schema as S } from "effect"
import { Flag } from "effect/cli"

export const commonFlags = {
  id: Flag.String("id").pipe(Flag.withDescription("Exact section ID"), Flag.optional, Flag.map(Option.getOrUndefined)),
  json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Output full records as a JSON array")),
  limit: Flag.Int("limit").pipe(
    Flag.withSchema(S.Int.check(S.isBetween({ minimum: 1, maximum: 1000 }))),
    Flag.withDefault(50),
    Flag.withDescription("Maximum matching results (1–1000)")
  ),
  since: Flag.String("since").pipe(
    Flag.withSchema(S.DateTimeUtcFromString),
    Flag.map(DateTime.toEpochMillis),
    Flag.withDescription("Include data at or after this date-time (for example, 2026-10-23T12:00:00Z)"),
    Flag.optional,
    Flag.map(Option.getOrUndefined)
  ),
  until: Flag.String("until").pipe(
    Flag.withSchema(S.DateTimeUtcFromString),
    Flag.map(DateTime.toEpochMillis),
    Flag.withDescription("Include data at or before this date-time"),
    Flag.optional,
    Flag.map(Option.getOrUndefined)
  )
}
