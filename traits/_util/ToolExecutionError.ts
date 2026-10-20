import { Cause, Effect, Schema as S } from "effect"

export class ToolExecutionError extends S.TaggedError<ToolExecutionError>()("ToolExecutionError", {
  details: S.String
}) {
  override get message() {
    return "Tool execution failed. Report the diagnostics to the user; do not treat this as a successful operation. Inspect stored traits before retrying a failed mutation."
  }
}

export const boundary = (cause: Cause.Cause<unknown>) =>
  Cause.hasInterruptsOnly(cause)
    ? Effect.interrupt
    : Effect.try(() => Cause.pretty(cause)).pipe(
        Effect.catchTags({ UnknownError: () => Effect.succeed("Unable to format the failure diagnostics.") }),
        Effect.flatMap((details) => ToolExecutionError.make({ details }))
      )
