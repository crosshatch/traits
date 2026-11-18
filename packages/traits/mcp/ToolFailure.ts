import { Array, Cause, Function, Option, pipe, String } from "effect"
import { AiError } from "effect/ai"

import PackageJson from "../package.json" with { type: "json" }
import { rejectsAccount } from "../util/rejectsAccount.ts"

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
} = Function.dual(2, (cause: Cause.Cause<unknown>, guidance: Guidance): string => {
  const provider = Cause.findErrorOption(cause).pipe(Option.filter(AiError.isAiError), Option.getOrUndefined)
  const status =
    provider !== undefined && "http" in provider.reason ? provider.reason.http?.response?.status : undefined
  return pipe(
    [
      Cause.pretty(cause),
      ...(provider === undefined
        ? []
        : [
            `Model request failed: ${provider.module}.${provider.method}; ${provider.reason._tag}${status === undefined ? "" : `; HTTP ${status}`}.`,
            rejectsAccount(provider)
              ? status === 402 || provider.reason._tag === "QuotaExhaustedError"
                ? "The provider account has insufficient credits or exhausted quota. Check billing, credits, and account limits before retrying."
                : "The provider rejected account access. Check credentials and permissions before retrying."
              : provider.isRetryable
                ? "The provider failure is retryable; retry after the provider's indicated delay or once the service recovers."
                : "This failure is not marked retryable. Resolve the provider error above before retrying."
          ]),
      "",
      guidance.outcome,
      Cause.hasDies(cause)
        ? `This is an unexpected error in traits ${PackageJson.version}, most likely a bug rather than something the user can fix. Tell the user, and ask whether they are alright with you opening an issue in crosshatch/traits (https://github.com/crosshatch/traits/issues) with this error, the traits version, and the tool call that failed, leaving out secrets and private source code. Open it only if they agree, for example with \`gh issue create --repo crosshatch/traits\`.`
        : `Tell the user what the error says to fix, without asking them to paste credentials into chat. ${guidance.recovery}`
    ],
    Array.join("\n"),
    String.trim
  )
})
