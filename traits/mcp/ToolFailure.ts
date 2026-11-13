import { Array, Cause, Function, pipe, String } from "effect"

import PackageJson from "../package.json" with { type: "json" }

/** What happened to a failed call's work, and how to retry once the user has fixed an expected failure. */
interface Guidance {
  /** What happened to the call's work, such as that nothing was checked. */
  readonly outcome: string
  /** How to retry once the user has fixed an expected failure. */
  readonly recovery: string
}

/**
 * Serializes why a tool call failed, then says what the agent should do next. An expected failure, such as invalid
 * configuration, missing credentials, or an unreadable trait file, is the user's to fix: the agent relays the error and
 * follows `recovery`. An unexpected error (a defect) is most likely a bug in traits, so the agent offers to report it.
 */
export const describe: {
  (guidance: Guidance): (cause: Cause.Cause<unknown>) => string
  (cause: Cause.Cause<unknown>, guidance: Guidance): string
} = Function.dual(2, (cause: Cause.Cause<unknown>, guidance: Guidance): string =>
  pipe(
    [
      Cause.pretty(cause),
      "",
      guidance.outcome,
      Cause.hasDies(cause)
        ? `This is an unexpected error in traits ${PackageJson.version}, most likely a bug rather than something the user can fix. Tell the user, and ask whether they are alright with you opening an issue in crosshatch/traits (https://github.com/crosshatch/traits/issues) with this error, the traits version, and the tool call that failed, leaving out secrets and private source code. Open it only if they agree, for example with \`gh issue create --repo crosshatch/traits\`.`
        : `Tell the user what the error says to fix, without asking them to paste credentials into chat. ${guidance.recovery}`
    ],
    Array.join("\n"),
    String.trim
  )
)
