import { Effect, Schema as S } from "effect"

/** Commands use {{prompt}} and {{session}} as complete shell arguments; values are passed through environment variables. */
export type AgentConfiguration = typeof AgentConfiguration.Type
export const AgentConfiguration = S.Struct({
  /** Shell template starting a new coding-agent session. */
  command: S.NonEmptyString.annotateKey({
    description:
      "Shell template starting a new coding-agent session, using {{prompt}} and {{session}} argument placeholders."
  }),
  /** Shell template resuming the same explicit session. */
  continue: S.NonEmptyString.annotateKey({ description: "Shell template resuming {{session}} with {{prompt}}." }),
  /** Client-specific prefix for generated UUID session identities; empty by default. */
  sessionPrefix: S.String.annotateKey({
    description:
      "Client-specific prefix for generated UUID session identities; empty by default. Set ses_ for OpenCode."
  }).pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefaultKey(Effect.succeed(""))),
  /** Maximum invocations per task, including the first; defaults to five. */
  maxSteps: S.Int.check(S.isGreaterThan(0)).pipe(
    S.withConstructorDefault(Effect.succeed(5)),
    S.withDecodingDefaultKey(Effect.succeed(5))
  )
})
