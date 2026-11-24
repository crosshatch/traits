import { Effect, Schema as S } from "effect"

/** The agent that carries out traits' preludes: a command run from the workspace root, given the task's instructions as its last argument, whose output is what the prelude found. */
export type PreludeAgentConfiguration = typeof PreludeAgentConfiguration.Type
export const PreludeAgentConfiguration = S.Struct({
  /** The program to run, such as claude or a script of the workspace's own. */
  command: S.NonEmptyString.annotateKey({
    description: "The program to run, such as claude or a script of the workspace's own."
  }),
  /** The arguments to run it with, before the task's instructions, such as those that limit which tools the agent may use; none when omitted. */
  args: S.Array(S.String)
    .annotateKey({
      description:
        "The arguments to run it with, before the task's instructions, such as those that limit which tools the agent may use; none when omitted."
    })
    .pipe(S.withDecodingDefaultKey(Effect.succeed([]))),
  /** The most seconds one task may take before it is stopped and its trait left not assessed. */
  timeoutSeconds: S.Int.check(S.isGreaterThan(0))
    .annotateKey({
      description: "The most seconds one task may take before it is stopped and its trait left not assessed."
    })
    .pipe(S.withDecodingDefaultKey(Effect.succeed(600)))
}).annotate({
  description:
    "The agent that carries out traits' preludes: a command run from the workspace root, given the task's instructions as its last argument, whose output is what the prelude found. What the agent can reach, such as which tools and systems, is up to the command."
})
