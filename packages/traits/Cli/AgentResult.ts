import { Array, Console, Effect, Runtime, Schema as S } from "effect"

import * as CodingAgent from "../local/CodingAgent.ts"

/** The agent needs a user's answer; preserve its session and make headless incompleteness visible to scripts. */
export class InputRequiredExit extends S.TaggedError<InputRequiredExit>()("InputRequiredExit", {
  session: S.String.annotateKey({ description: "Agent session to continue after obtaining the user's answer." }),
  stdout: S.Array(S.String).annotateKey({
    description: "Saved transcripts containing the agent's question or blocker."
  })
}) {
  override readonly [Runtime.errorExitCode] = 2

  override get message(): string {
    return `User input is required. Review ${Array.join(this.stdout, ", ")} and resume session ${this.session} using the configured agent.continue command.`
  }
}

/** Reports a run; user-input handoffs exit nonzero instead of being mistaken for completion. */
export const report = Effect.fn("AgentResult.report")(function* (result: CodingAgent.Result) {
  yield* Console.log(`Session ${result.session}: ${Array.join(result.stdout, ", ")}`)
  if (CodingAgent.Result.guards.InputRequired(result)) {
    return yield* InputRequiredExit.make({ session: result.session, stdout: result.stdout })
  }
})
