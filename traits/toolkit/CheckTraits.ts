import { Array, Crypto, Effect, FileSystem, flow, Path, pipe, Schema as S, String } from "effect"
import { DecisionModel, Tool, Toolkit } from "effect/ai"
import { ChildProcessSpawner } from "effect/process"

import { cachedAll } from "../EvaluationCache.ts"
import { getIncludedFiles, GitFileListingError } from "../getIncludedFiles.ts"
import { Source, SourceLocation } from "../Source.ts"
import * as Trait from "../Trait.ts"
import * as Evaluation from "../TraitEvaluation.ts"
import { excludeIgnored } from "../traitIgnores.ts"
import { TraitsContext } from "../TraitsContext.ts"
import { TraitStore, TraitStoreError } from "../TraitStore.ts"

export class ReviewScopeRequired extends S.TaggedError<ReviewScopeRequired>()("ReviewScopeRequired", {
  configRoot: S.String
}) {
  override get message() {
    return "Configure TraitsConfig.includes with the complete eligible project-file scope before checking coverage."
  }
}

export class ReviewScopeEmpty extends S.TaggedError<ReviewScopeEmpty>()("ReviewScopeEmpty", {
  configRoot: S.String,
  includes: S.Array(S.String)
}) {
  override get message() {
    return "The configured coverage scope matched no eligible files; no coverage was established."
  }
}

export class CoverageBaselineRequired extends S.TaggedError<CoverageBaselineRequired>()("CoverageBaselineRequired", {
  directory: S.String
}) {
  override get message() {
    return "Initial project coverage requires approval: call check_traits with establishBaseline: true after approving the cold-baseline model cost."
  }
}

export const CheckTraits = Tool.make("check_traits", {
  description: String.stripMargin(`
  | Use after generating or editing TypeScript files, after saving or resolving a relevant trait, and before committing or opening a PR.
  | Assess only project-owned source files and relevant authored configuration or documentation. Do not audit third-party or generated code.
  | Every call reconciles the complete project scope declared by TraitsConfig.includes against all stored traits. Configure an explicit owned-file manifest/globs; missing scope fails rather than claiming partial coverage.
  | Never submit secrets, .env files, credentials, binary assets, generated lockfiles, dependency trees, or reference repositories for assessment.
  | Supply include as TypeScript file paths or glob patterns relevant to the work, relative to the MCP working directory or absolute.
  | Globs are expanded and overlapping matches are checked once. Directories are not reviewed as files; use patterns such as traits/**/*.ts.
  | Built-in exclusions cover dependency trees, Git metadata, and nested worktrees. Configure project-specific exclusions through TraitsConfig.excludes.
  | Configured exclusions are filenames or native filesystem glob patterns, resolved beside traits.ts. Use directory/** to exclude a subtree; bare directories are not expanded.
  | Git-ignored files are excluded by default, with ignore rules refreshed on every call. Untracked files do not need to be added to Git to be evaluated. Tracked files remain eligible even if ignore rules match them. Set excludeGitignored: false in traits.ts to disable this filter; explicit excludes still apply. Git failures fail the check.
  | All entries follow native glob syntax, including escaping filenames with glob characters. No custom directory expansion or literal-path classification is applied.
  | Reads current full file contents, including unstaged edits, in 200-line chunks. Reuses persisted assessments for identical trait bodies and source text/location; only missing pairs require model calls.
  | Include can add files but cannot narrow configured scope. Every new/changed chunk is checked against all traits; every new/changed trait is checked against all eligible chunks. Unchanged pairs reuse assessments rather than model calls.
  | Cached violations remain findings. Inconclusive assessments and failed model calls are not cached. Cache files contain assessments only, not source or trait bodies, under .agents/assessments/.
  | A cold baseline requires explicit cost approval through establishBaseline: true. CoverageBaselineRequired means no baseline was approved, not that the project passed.
  | traitIds is accepted for compatibility and validated, but cannot narrow coverage or hide findings. Unknown IDs fail the call.
  | A leading // traits-ignore-file <trait-id-or-name>: <reason> comment skips matching traits for the entire file. UUIDs match one trait; names match all traits with that exact name. Names are case-sensitive and must be updated after renaming; use a UUID for a stable single-trait exception. Directives require a reason and must precede code.
  | Missing assessments are batched with frontmatter-aware applicability, preserving the evaluator's request-size and concurrency limits.
  | Returns findings with the trait, source text, absolute path, 1-based chunk startLine, and assessment classification and probabilities.
  | Classification distinguishes violation from inconclusive; probabilities are not calibrated guarantees. No exact offending lines are provided.
  | Diagnose uncertainty using the full distribution, not the selected label alone; inspect source and trait before changing code.
  | Act on the results: inspect every finding and automatically fix confirmed, applicable violations without waiting for a separate request.
  | Make minimal behavior-preserving code changes, then rerun this tool on the corrected files and run relevant project checks.
  | Repeat for remaining confirmed violations; returning a findings summary alone does not complete the review.
  | Do not weaken a trait to make code pass or change correct code for an inapplicable or inconclusive finding.
  | Triage each finding before reporting it. Routine summaries should surface confirmed issues, meaningful unresolved uncertainty, errors, and decision blockers.
  | Do not distract the user with rejected, irrelevant false positives; retain raw results in tool output for audit and explain them when requested or materially significant.
  | Do not hide actionable findings based only on probability/confidence or claim the automated check was clean when raw findings remain.
  | Ask for clarification when a fix changes behavior or exceeds authorized scope.
  | The tool diagnoses only; the calling agent is responsible for edits, verification, and reporting unresolved blockers.
  | Unmatched patterns select no files. An empty result means no failures for this selection, not a repository-wide guarantee.
  | Empty include/traitIds lists do not bypass configured coverage. No matched files or an empty store checks no pairs, not a clean project.
  | On unexpected tool errors, inspect otel_status and search otel_search_traces or otel_search_logs for service traits around the failure time.
  | Follow trace/span IDs with otel_get_trace and otel_get_span. Treat missing telemetry as incomplete evidence, not success.
  `),
  parameters: S.Struct({
    include: S.Array(S.String).annotate({
      description:
        "Additional owned-file paths/globs; may be empty. Cannot narrow the authoritative TraitsConfig.includes scope. Never include secrets, generated/dependency/reference code or binary assets."
    }),
    traitIds: S.Array(Trait.TraitId).pipe(S.optional).annotate({
      description:
        "Compatibility UUID trait IDs, validated but never used to narrow incremental coverage. Omit normally."
    }),
    establishBaseline: S.Boolean.pipe(S.optional).annotate({
      description:
        "Set true only after approving the first full-project baseline cost. Later checks assess only missing pairs."
    })
  }),
  success: S.Array(Evaluation.TraitEvaluation),
  failure: S.Union([
    S.TaggedStruct("AiError", { message: S.String }),
    TraitStoreError,
    S.Struct({ ...Evaluation.TraitAssessmentTooLargeError.fields, message: S.String }),
    S.Struct({ ...GitFileListingError.fields, message: S.String }),
    ReviewScopeRequired,
    ReviewScopeEmpty,
    CoverageBaselineRequired
  ]),
  failureMode: "return",
  dependencies: [
    DecisionModel.DecisionModel,
    TraitStore,
    FileSystem.FileSystem,
    Crypto.Crypto,
    Path.Path,
    ChildProcessSpawner.ChildProcessSpawner,
    TraitsContext
  ]
})
  .annotate(Tool.Title, "Check Traits")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, false)

export const toolkit = Toolkit.make(CheckTraits)

export const check = Effect.fn("CheckTraits.check")(function* (params: {
  readonly include: ReadonlyArray<string>
  readonly traitIds?: ReadonlyArray<Trait.TraitId> | undefined
  readonly establishBaseline?: boolean | undefined
}) {
  const store = yield* TraitStore
  const context = yield* TraitsContext.pipe(
    Effect.filterOrFail(
      (context) => context.config.includes.length > 0,
      (context) => ReviewScopeRequired.make({ configRoot: context.configRoot })
    )
  )
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const cwd = path.resolve()
  const cacheContext = yield* fs
    .readFileString(path.join(context.configRoot, "traits.ts"))
    .pipe(Effect.catchReasons("PlatformError", { NotFound: () => Effect.succeed("") }))
  const includedFiles = yield* getIncludedFiles
  // A caller's focused request must never hide other uncovered pairs.
  if (params.traitIds !== undefined) {
    yield* Effect.forEach(Array.dedupe(params.traitIds), store.get, { concurrency: "unbounded" })
  }
  const traits = yield* store.ls
  const cacheDirectory = path.join(context.configRoot, ".agents/assessments")
  const baselineApproval = path.join(cacheDirectory, "baseline-approved.json")
  if (params.establishBaseline !== true) {
    yield* fs.exists(baselineApproval).pipe(
      Effect.filterOrFail(
        (exists) => exists,
        () => CoverageBaselineRequired.make({ directory: context.configRoot })
      )
    )
  }
  const configuredPatterns = pipe(
    context.config.includes,
    Array.map((pattern) => path.resolve(context.configRoot, pattern)),
    Array.dedupe
  )
  const matches = yield* Effect.forEach(
    Array.dedupe([...configuredPatterns, ...Array.map(params.include, (pattern) => path.resolve(cwd, pattern))]),
    (pattern) => {
      const absolute = path.isAbsolute(pattern) ? pattern : `${cwd}${path.sep}${pattern}`
      return fs.glob(absolute, {
        root: context.configRoot,
        exclude: context.excludes
      })
    },
    { concurrency: "unbounded" }
  )
  const resolved = pipe(
    matches,
    Array.flatten,
    Array.map((file) => path.resolve(context.configRoot, file)),
    Array.dedupe
  )
  const configuredFiles = pipe(
    matches,
    Array.take(configuredPatterns.length),
    Array.flatten,
    Array.map((file) => path.resolve(context.configRoot, file))
  )
  const paths = yield* Effect.filter(
    includedFiles === undefined ? resolved : Array.filter(resolved, (file) => includedFiles.has(file)),
    flow(
      fs.stat,
      Effect.map((info) => info.type === "File")
    ),
    { concurrency: "unbounded" }
  ).pipe(
    Effect.filterOrFail(
      (paths) => Array.some(paths, (file) => Array.contains(configuredFiles, file)),
      () => ReviewScopeEmpty.make({ configRoot: context.configRoot, includes: context.config.includes })
    )
  )
  if (params.establishBaseline === true) {
    yield* fs.makeDirectory(cacheDirectory, { recursive: true })
    // This records cost approval, not a completed or compliant review.
    yield* fs.writeFileString(baselineApproval, '{"version":1}')
  }
  const results = yield* Effect.forEach(
    paths,
    Effect.fn("CheckTraits.file")(function* (file) {
      const text = yield* fs.readFileString(file)
      const activeTraits = pipe(traits, excludeIgnored(text))
      const chunks = Array.chunksOf(String.split(text, "\n"), 200)
      const sources = Array.map(chunks, (lines, index) =>
        Source.make({
          text: Array.join(lines, "\n"),
          location: SourceLocation.cases.File.make({ path: file, startLine: index * 200 + 1 })
        })
      )
      const results = yield* Effect.forEach(
        sources,
        (source) =>
          cachedAll({
            directory: cacheDirectory,
            traits: activeTraits,
            source,
            context: cacheContext,
            evaluate: (missing) => Evaluation.evaluateAll(missing, source)
          }),
        { concurrency: "unbounded" }
      )
      return pipe(results, Array.flatten, Array.filter(Evaluation.requiresReview))
    }),
    { concurrency: "unbounded" }
  )
  return Array.flatten(results)
})

export const layer = toolkit.toLayer({ check_traits: check })
