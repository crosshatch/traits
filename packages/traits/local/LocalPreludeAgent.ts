import { Duration, Effect, Layer, Option, pipe, Schema as S, String } from "effect"

import * as Prelude from "../TraitRun/Prelude.ts"
import { runProcess } from "../util/process/runProcess.ts"
import { LocalPaths } from "./LocalPaths.ts"
import type { PreludeAgentConfiguration } from "./TraitsConfig/PreludeAgentConfiguration.ts"

// Enough of what a failed agent printed to say why, without flooding the report.
const reasonLength = 2_000

/** What an agent prints when it reports what a task cost, as claude -p --output-format json does: what it found under result, and the cost in US dollars under total_cost_usd. */
const PricedReply = S.fromJsonString(
  S.Struct({ result: S.String, total_cost_usd: S.Finite.check(S.isGreaterThanOrEqualTo(0)) })
)

/** What an agent printed, as what it found and, when it reports one, what it cost. */
const replyOf = (printed: string): Prelude.PreludeReply =>
  Option.match(S.decodeOption(PricedReply)(printed), {
    onNone: () => ({ found: printed }),
    onSome: (priced) => ({ found: String.trim(priced.result), cost: priced.total_cost_usd })
  })

/** An agent that carries out each task by running the configured command from the workspace root, with the task's instructions as its last argument. What it prints is what the task found, unless it prints what it found with what it cost, as claude -p --output-format json does; a command that fails, finds nothing, or runs past its time leaves the trait not assessed. */
export const make = Effect.fnUntraced(function* (configuration: PreludeAgentConfiguration) {
  const paths = yield* LocalPaths
  const services = yield* Effect.context<Effect.Services<ReturnType<typeof runProcess>>>()
  const fail = (task: Prelude.PreludeTask, reason: string) =>
    Prelude.PreludeError.make({ traitName: task.trait.name, reason: pipe(reason, String.slice(0, reasonLength)) })
  return {
    carryOut: (task) =>
      runProcess({
        command: configuration.command,
        args: [...configuration.args, Prelude.instructions(task)],
        cwd: paths.root
      }).pipe(
        Effect.provideContext(services),
        Effect.mapError((error) => fail(task, error.message)),
        Effect.timeoutOrElse({
          duration: Duration.seconds(configuration.timeoutSeconds),
          orElse: () => Effect.fail(fail(task, `The agent took longer than ${configuration.timeoutSeconds} seconds.`))
        }),
        Effect.flatMap(({ exitCode, stderr, stdout }) => {
          const printed = String.trim(stdout)
          if (exitCode !== 0) {
            return Effect.fail(fail(task, `The agent exited with ${exitCode}: ${String.trim(stderr) || printed}`))
          }
          const reply = replyOf(printed)
          return String.isEmpty(reply.found)
            ? Effect.fail(fail(task, "The agent found nothing to report."))
            : Effect.succeed(reply)
        }),
        Effect.tap(({ found }) => Effect.logDebug(`Prelude of ${task.trait.name} for ${task.file} found:\n${found}`))
      )
  } satisfies Prelude.PreludeAgentService
})

/** Carries out preludes with the configured agent; without one, every prelude is turned away and its trait left not assessed. */
export const layer = (configuration: PreludeAgentConfiguration | undefined) =>
  configuration === undefined ? Layer.empty : Layer.effect(Prelude.PreludeAgent, make(configuration))
