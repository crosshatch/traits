import { Array, Effect, FileSystem, Path, pipe, Schema as S, String } from "effect"
import { AiError, DecisionModel, Tool, Toolkit } from "effect/ai"

import { Source, SourceLocation } from "../Source.ts"
import { TraitId } from "../Trait.ts"
import { evaluate, requiresReview, TraitEvaluation } from "../TraitEvaluation.ts"
import { TraitsContext } from "../TraitsContext.ts"
import { TraitStore, TraitStoreError } from "../TraitStore.ts"

export const CheckTraits = Tool.make("check_traits", {
  description: String.stripMargin(`
  | Use after generating or editing TypeScript files, after saving or resolving a relevant trait, and before committing or opening a PR.
  | Select concrete TypeScript files relevant to the work. Pass file paths, not directories, globs, patches, or Git revision selectors.
  | Reads current full file contents, including unstaged edits, and checks each 200-line chunk against the selected traits in parallel.
  | Omit traitIds to check all stored traits; supply trait ids for a focused check of one or more traits. Unknown IDs fail the call.
  | Returns findings with the trait, source text, absolute path, 1-based chunk startLine, and assessment classification and probabilities.
  | Classification distinguishes violation from inconclusive; probabilities are not calibrated guarantees. No exact offending lines are provided.
  | Diagnose uncertainty using the full distribution, not the selected label alone; inspect source and trait before changing code.
  | Act on the results: inspect every finding and automatically fix confirmed, applicable violations without waiting for a separate request.
  | Make minimal behavior-preserving code changes, then rerun this tool on the corrected files and run relevant project checks.
  | Repeat for remaining confirmed violations; returning a findings summary alone does not complete the review.
  | Do not weaken a trait to make code pass or change correct code for an inapplicable or inconclusive finding.
  | Explain retained false positives and justified exceptions. Ask for clarification when a fix changes behavior or exceeds authorized scope.
  | The tool diagnoses only; the calling agent is responsible for edits, verification, and reporting unresolved blockers.
  | An empty result means no failures for this selection, not a repository-wide guarantee. Empty files/traitIds lists or an empty store check no pairs.
  `),
  parameters: S.Struct({
    files: S.Array(S.String).annotate({
      description:
        "TypeScript files to review, absolute or relative to the MCP working directory. Duplicate resolved paths are checked once."
    }),
    traitIds: S.Array(TraitId).pipe(S.optional).annotate({
      description: "Optional trait ids for a focused review. Omit for all stored traits; an empty array selects none."
    })
  }),
  success: S.Array(TraitEvaluation),
  failure: S.Union([AiError.AiError, TraitStoreError]),
  dependencies: [DecisionModel.DecisionModel, TraitStore, FileSystem.FileSystem, Path.Path, TraitsContext]
})
  .annotate(Tool.Title, "Check Traits")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)

export const toolkit = Toolkit.make(CheckTraits)

export const layer = toolkit.toLayer({
  check_traits: Effect.fn("CheckTraits.check")(function* (params) {
    const store = yield* TraitStore
    const { agentId } = yield* TraitsContext
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const traits = yield* params.traitIds === undefined
      ? store.ls
      : Effect.forEach(Array.dedupe(params.traitIds), store.get, { concurrency: "unbounded" })
    const paths = pipe(
      params.files,
      Array.map((file) => path.resolve(file)),
      Array.dedupe
    )
    const results = yield* Effect.forEach(
      paths,
      Effect.fn("CheckTraits.file")(function* (file) {
        const text = yield* fs.readFileString(file)
        const chunks = Array.chunksOf(String.split(text, "\n"), 200)
        const sources = Array.map(chunks, (lines, index) =>
          Source.make({
            agentId,
            text: Array.join(lines, "\n"),
            location: SourceLocation.cases.File.make({ path: file, startLine: index * 200 + 1 })
          })
        )
        const results = yield* Effect.forEach(
          sources,
          (source) => Effect.forEach(traits, (trait) => evaluate(trait, source), { concurrency: "unbounded" }),
          { concurrency: "unbounded" }
        )
        return pipe(results, Array.flatten, Array.filter(requiresReview))
      }),
      { concurrency: "unbounded" }
    )
    return Array.flatten(results)
  })
})
