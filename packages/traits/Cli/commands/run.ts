import { Array, Console, Effect, Layer, Option, pipe, Schema as S, String } from "effect"
import { Argument, Command } from "effect/cli"

import * as Estimate from "../../Estimate/Estimate.ts"
import * as LocalDecisionCache from "../../local/LocalDecisionCache.ts"
import * as LocalEnvFile from "../../local/LocalEnvFile.ts"
import * as LocalRun from "../../local/LocalRun.ts"
import * as ModelConfiguration from "../../local/TraitsConfig/ModelConfiguration.ts"
import * as TraitRun from "../../TraitRun/TraitRun.ts"
import { TraitSelectionId } from "../../TraitSelection/TraitSelectionId.ts"
import { CommandFailed, exitWith } from "../CommandExit.ts"
import * as FlagsCommon from "../FlagsCommon.ts"

const noDefaultSelection =
  "No selection was given, and traits/config.json declares no selection with the ID default. Declare one under selections, or name the selection to run."

export const run = Command.make(
  "run",
  {
    selections: Argument.String("selections").pipe(
      Argument.withSchema(TraitSelectionId),
      Argument.withDescription(
        "Selections declared in traits/config.json whose traits to run; the selection with the ID default when omitted"
      ),
      Argument.atLeast(0)
    ),
    ...FlagsCommon
  },
  Effect.fn("run")(
    function* ({ dotenv, dry, json, selections, stopAfterCost, threshold }) {
      // The configuration is read when a run starts, and what the run is handed goes by it, so an edit made since the last run takes effect.
      const { config, files, segmentation } = yield* LocalRun.prepare
      if (dry) {
        const estimate = yield* Estimate.estimate({ files, segmentation, selections, threshold }).pipe(
          // Nothing is asked of the model, so its credentials are not read, and nothing is remembered, so no cache is made.
          Effect.provide(LocalDecisionCache.layerExisting(config.models.decision))
        )
        const encoded = yield* pipe(estimate, S.encodeEffect(Estimate.Estimate), Effect.orDie)
        return yield* Console.log(json ? JSON.stringify(encoded, null, 2) : Estimate.format(encoded))
      }
      const stopAfter = Option.match(stopAfterCost, {
        onSome: (dollars): TraitRun.Budget | undefined => ({ dollars }),
        onNone: () => undefined
      })
      const report = yield* TraitRun.run({ files, segmentation, selections, threshold, stopAfter }).pipe(
        // Answers are remembered for the model that gave them, so a change of model asks again.
        Effect.provide([
          ModelConfiguration.layerDecision(config.models.decision).pipe(
            Layer.provide(LocalEnvFile.layer({ file: Option.getOrUndefined(dotenv) }))
          ),
          LocalDecisionCache.layer(config.models.decision)
        ])
      )
      const encoded = yield* pipe(report, S.encodeEffect(TraitRun.Report), Effect.orDie)
      yield* Console.log(json ? JSON.stringify(encoded, null, 2) : TraitRun.format(encoded))
      const counts = TraitRun.tally(report)
      if (counts.Violated > 0) {
        return yield* exitWith(1)
      }
      if (counts.NotAssessed > 0) {
        return yield* exitWith(2)
      }
    },
    (effect, { selections }) => {
      // Whatever kept the run from its work is reported with its own message, and the run ends as one that could not do it.
      return effect.pipe(
        Effect.catchIf(
          (error) => !(error instanceof CommandFailed),
          (error) => {
            switch (error._tag) {
              // The provider's key is read from the environment, and its own error only names the variable in passing.
              case "ConfigError":
                return CommandFailed.make({
                  reason: `Could not read the credentials for the models in traits/config.json from the environment: ${pipe(error.message, String.replaceAll(/\s+/gu, " "))}. Set the variable it names, in the environment or in .env, or name another .env file that sets it with --dotenv, then run again.`
                })
              // A missing default selection was not one the user typed, so the reason says where it was expected and what to do.
              case "TraitSelectionNotFoundError":
                return CommandFailed.make({
                  reason: Array.isReadonlyArrayNonEmpty(selections) ? error.message : noDefaultSelection
                })
              default:
                return CommandFailed.make({ reason: error.message })
            }
          }
        )
      )
    }
  )
).pipe(
  Command.withDescription(
    "Run the traits in the given selections, or in the selection with the ID default when none is given, against every project file, and print what needs attention; --json prints the full report. --dry prints what the run would cost instead of running it, and --stop-after-cost ends a run once it has cost that much. The model's credentials are read from the environment, and from .env or the file --dotenv names. Exits with 1 when an assertion is violated, and 2 when something could not be assessed."
  )
)
