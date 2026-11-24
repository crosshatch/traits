import { Array, Effect, Ref, Schema as S, Struct } from "effect"
import { DecisionModel } from "effect/ai"

import type { StorageError } from "../StorageError.ts"
import * as DecisionCache from "../TraitRun/DecisionCache.ts"
import * as PlanningModel from "../TraitRun/PlanningModel.ts"
import * as Prelude from "../TraitRun/Prelude.ts"
import * as TraitRun from "../TraitRun/TraitRun.ts"
import { TraitReference } from "../TraitSelection/TraitReference.ts"
import type { TraitSelectionId } from "../TraitSelection/TraitSelectionId.ts"
import type { Probability } from "../util/Probability.ts"

/** What a run would ask of the model, as far as can be told without asking it. */
export type ExpectedUsage = typeof ExpectedUsage.Type
export const ExpectedUsage = TraitRun.Usage.mapFields(Struct.omit(["outputTokens", "cost"])).annotate({
  description: "What a run would ask of the model, as far as can be told without asking it."
})

/** What a run is expected to cost, worked out without asking the model anything: the least it can come to and the most. Tokens are approximated from the size of each request. */
export type Estimate = typeof Estimate.Type
export const Estimate = S.Struct({
  /** The traits that would be run, in order. */
  traits: S.Array(TraitReference).annotateKey({ description: "The traits that would be run, in order." }),
  /** How many files would be checked. */
  files: S.Int.annotateKey({ description: "How many files would be checked." }),
  /** How many files would be skipped for holding no text. */
  skipped: S.Int.annotateKey({ description: "How many files would be skipped for holding no text." }),
  /** What is certain to be asked: every question that is not already answered, where no trait is found to apply beyond those already known to. */
  atLeast: ExpectedUsage.annotateKey({
    description:
      "What is certain to be asked: every question that is not already answered, where no trait is found to apply beyond those already known to."
  }),
  /** What is asked if every trait is found to apply to every file and segment it is asked about, which no run can exceed. */
  atMost: ExpectedUsage.annotateKey({
    description:
      "What is asked if every trait is found to apply to every file and segment it is asked about, which no run can exceed."
  }),
  /** How many tasks an agent would be given to carry out traits' preludes, at the least and at the most; what the agent uses is not counted in the tokens. */
  preludeTasks: S.Struct({
    /** The tasks certain to be given. */
    atLeast: S.Int.annotateKey({ description: "The tasks certain to be given." }),
    /** The tasks given if every trait with a prelude applies to every file it can. */
    atMost: S.Int.annotateKey({
      description: "The tasks given if every trait with a prelude applies to every file it can."
    })
  }).annotateKey({
    description:
      "How many tasks an agent would be given to carry out traits' preludes, at the least and at the most; what the agent uses is not counted in the tokens."
  })
}).annotate({
  description:
    "What a run is expected to cost, worked out without asking the model anything: the least it can come to and the most. Tokens are approximated from the size of each request."
})

/** Works out what a run would cost without asking the model anything, so it needs no model. Answers remembered from earlier runs count as they would in the run, and nothing is added to them. */
export const estimate = Effect.fn("Estimate.estimate")(function* <R = never>(options: {
  readonly files: TraitRun.Files
  /** How the files are divided into the segments that are checked on their own, as a run would get it ready. Every file is checked whole when omitted. */
  readonly segmentation?: Effect.Effect<TraitRun.Segmentation, StorageError, R> | undefined
  readonly selections: ReadonlyArray<TraitSelectionId>
  /** The probability, from 0 to 1, at or above which a trait applies to what is checked, which decides what the remembered answers lead to. */
  readonly threshold: Probability
}) {
  const { files, selections, threshold } = options
  // Got ready once, so that both walks through the run divide the files the same way.
  const segment = options.segmentation === undefined ? undefined : yield* options.segmentation
  // The run reads what is remembered and is kept from adding to it, since the answers it is given here are made up.
  const remembered = yield* DecisionCache.DecisionCache.useSync(DecisionCache.readOnly)
  // What follows a question depends on its answer, so the run is walked through twice: once with no trait applying, and once with every trait applying.
  const walk = Effect.fnUntraced(function* (probability: number) {
    const model = yield* PlanningModel.make(probability)
    // Preludes are not carried out, only counted, and what they would find stands in as the same text for every task.
    const tasks = yield* Ref.make(0)
    const agent: Prelude.PreludeAgentService = {
      carryOut: () =>
        Effect.as(
          Ref.update(tasks, (n) => n + 1),
          "What the prelude would find."
        )
    }
    const report = yield* TraitRun.run({
      files,
      selections,
      threshold,
      ...(segment === undefined ? {} : { segmentation: Effect.succeed(segment) })
    }).pipe(
      Effect.provideService(DecisionModel.DecisionModel, model),
      Effect.provideService(DecisionCache.DecisionCache, remembered),
      Effect.provideService(Prelude.PreludeAgent, agent)
    )
    return { report, preludeTasks: yield* Ref.get(tasks) }
  })
  const lowest = yield* walk(0)
  const highest = yield* walk(1)
  const least = lowest.report
  const most = highest.report
  return Estimate.make({
    traits: least.traits,
    files: least.files.length,
    skipped: least.skipped.length,
    atLeast: Struct.omit(least.usage, ["outputTokens", "cost"]),
    atMost: Struct.omit(most.usage, ["outputTokens", "cost"]),
    preludeTasks: { atLeast: lowest.preludeTasks, atMost: highest.preludeTasks }
  })
})

const count = (value: number) => new Intl.NumberFormat("en-US").format(value)

/** What a run would cost at the least and at the most, and what those two mean. */
export const format = (estimate: typeof Estimate.Encoded): string => {
  const bound = ({ inputTokens, remembered, requests }: typeof ExpectedUsage.Encoded) =>
    `${count(requests)} requests, about ${count(inputTokens)} tokens in, ${count(remembered)} answers remembered from earlier runs`
  return Array.join(
    [
      `Would check ${count(estimate.files)} files against ${estimate.traits.length} traits${estimate.skipped > 0 ? `, and skip ${count(estimate.skipped)} files for holding no text` : ""}.`,
      `At least: ${bound(estimate.atLeast)}.`,
      `At most: ${bound(estimate.atMost)}.`,
      ...(estimate.preludeTasks.atMost > 0
        ? [
            `Preludes: ${count(estimate.preludeTasks.atLeast)} to ${count(estimate.preludeTasks.atMost)} tasks for the agent, whose own usage is not counted above.`
          ]
        : []),
      "The least is what is certain to be asked. The most is reached only if every trait applies to every file and segment it is asked about. Tokens are approximated from the size of each request; nothing was asked of the model."
    ],
    "\n"
  )
}
