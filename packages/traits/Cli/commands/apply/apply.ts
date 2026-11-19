import { Console, Effect, Option } from "effect"
import { Argument, Command, Flag } from "effect/cli"

import { EnvironmentName } from "../../../EnvironmentName.ts"
import * as WorkspaceApply from "../../../local/WorkspaceApply.ts"
import type { TraitSelection } from "../../../local/WorkspaceTraits.ts"
import { TraitName } from "../../../TraitName.ts"
import * as AgentResult from "../../AgentResult.ts"

/** Shared CLI presentation for explicit apply and add/pull --apply. */
export const run = Effect.fn("apply.run")(function* (selection: TraitSelection) {
  const { traits, reportFile, prompt, execution } = yield* WorkspaceApply.run(selection)
  if (traits.length === 0) {
    yield* Console.log("No traits selected for application.")
    return
  }
  yield* Console.log(`Application report: ${reportFile}`)
  if (execution === undefined) {
    yield* Console.log(prompt)
  } else {
    yield* AgentResult.report(execution)
  }
})

export const apply = Command.make(
  "apply",
  {
    traits: Argument.String("traits").pipe(Argument.withSchema(TraitName), Argument.atLeast(0)),
    environment: Flag.String("environment").pipe(Flag.withSchema(EnvironmentName), Flag.optional)
  },
  Effect.fn("apply")((params) =>
    run({
      ...(params.traits.length === 0 ? {} : { traits: params.traits }),
      environment: Option.getOrUndefined(params.environment)
    })
  )
).pipe(
  Command.withDescription(
    "Apply installed traits without re-importing; returns instructions when no agent command is configured"
  )
)
