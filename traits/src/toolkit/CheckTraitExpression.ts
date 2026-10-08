import { Array, Effect, FileSystem, Path, pipe, Schema as S, String } from "effect"
import { AiError, DecisionModel, Tool, Toolkit } from "effect/ai"

import { Source, SourceLocation } from "../Source.ts"
import { TraitId } from "../Trait.ts"
import { check, TraitExpression } from "../TraitExpression.ts"
import { TraitsContext } from "../TraitsContext.ts"
import { TraitStore, TraitStoreError } from "../TraitStore.ts"

export const CheckTraitExpression = Tool.make("check_trait_expression", {
  description: String.stripMargin(`
  | Use after generating or editing TypeScript files, after saving or resolving a relevant trait, and before committing or opening a PR.
  | Select concrete TypeScript files relevant to the work. Pass file paths, not directories, globs, patches, or Git revision selectors.
  | Reads current full file contents, including unstaged edits, and checks each 200-line chunk against the selected traits in parallel.
  | Omit traitIds to check all stored traits; supply trait ids for a focused check of one or more traits. Unknown IDs fail the call.
  | Returns Fail entries for both violations and inconclusive assessments, with the trait, source text, absolute path, and 1-based chunk startLine.
  | The result does not distinguish these two outcomes or provide exact offending lines; inspect the source and trait before making changes.
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
  success: S.Array(TraitExpression.cases.Fail),
  failure: S.Union([AiError.AiError, TraitStoreError]),
  dependencies: [DecisionModel.DecisionModel, TraitStore, FileSystem.FileSystem, Path.Path, TraitsContext]
})
  .annotate(Tool.Title, "Check Trait Expression")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)

export const toolkit = Toolkit.make(CheckTraitExpression)

export const layer = toolkit.toLayer({
  check_trait_expression: Effect.fnUntraced(function* (params) {
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
      Effect.fnUntraced(function* (file) {
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
          (source) => Effect.forEach(traits, (trait) => check(trait, source), { concurrency: "unbounded" }),
          { concurrency: "unbounded" }
        )
        return pipe(results, Array.flatten, Array.filter(TraitExpression.guards.Fail))
      }),
      { concurrency: "unbounded" }
    )
    return Array.flatten(results)
  })
})
