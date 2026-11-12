import { Cause, Effect, pipe, Schema as S, String } from "effect"
import { Tool, Toolkit } from "effect/ai"

import * as WorkspaceCheck from "../local/WorkspaceCheck.ts"
import { EnvironmentName } from "../local/WorkspaceTraits.ts"
import { Report } from "../Report/Report.ts"
import { TraitName } from "../TraitName.ts"

/** A check could not run; the message says what to fix. */
export class TraitsCheckFailure extends S.TaggedError<TraitsCheckFailure>()("TraitsCheckFailure", {
  /** What prevented the check, and how to fix it. */
  message: S.String.annotateKey({ description: "What prevented the check, and how to fix it." })
}) {}

/** Checks workspace files against the workspace's traits using the models configured in traits.json. */
export const TraitsCheck = Tool.make("traits.check", {
  description: pipe(
    String.stripMargin(`
    |Check files against this workspace's traits. Each file's current text is compared with its text at Git HEAD, so deleted files can be checked too.
    |Call it before finishing any task that created, edited, or deleted files, rather than after each edit.
    |For the files a task created, edited, or deleted, pass all their paths in one call and omit traits, so every trait is checked. To recheck fixes, pass only the affected paths and traits.
    |For a created or changed trait, pass its name in traits and omit paths, so every project file is checked: tracked and untracked text files that Git does not ignore.
    |When passing paths, never pass dependencies, generated output, lockfiles, secrets, .env files, credentials, or binary files. Pass an environment or other trait names only when the user asks for them.
    |Returns the full report: for each trait and file, the targets with their subject-match and pass, fail, na, and uncertain probabilities, plus any failures that prevented complete checking.
    |Targets the trait's subject does not cover are reported as Unmatched and not assessed, which keeps checking all files cheap.
    |A high fail probability means a likely violation; a target where neither pass nor fail is likely is Inconclusive, which is unresolved rather than a violation. Probabilities are evidence, not guarantees.
    |If the check fails, nothing was checked and it is not a pass: follow the message, for example by running \`traits update\` to migrate an outdated workspace, or report it to the user when you cannot resolve it.
    `),
    String.trim
  ),
  parameters: S.Struct({
    /** Files to check, relative to the workspace root; every project file when omitted. */
    paths: S.NonEmptyArray(S.NonEmptyString)
      .annotateKey({
        description:
          "Files to check, relative to the workspace root; when omitted, every tracked or untracked text file that Git does not ignore."
      })
      .pipe(S.optionalKey),
    /** An environment in .agents/traits/_environments whose traits to check; every trait when omitted. */
    environment: EnvironmentName.annotateKey({
      description: "An environment in .agents/traits/_environments whose traits to check; every trait when omitted."
    }).pipe(S.optionalKey),
    /** Traits to check, within the environment when one is given. */
    traits: S.NonEmptyArray(TraitName)
      .annotateKey({ description: "Traits to check, within the environment when one is given." })
      .pipe(S.optionalKey)
  }),
  success: Report,
  failure: TraitsCheckFailure,
  failureMode: "return"
})
  .annotate(Tool.Title, "Check Traits")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)

/** The traits.check toolkit. */
export const toolkit = Toolkit.make(TraitsCheck)

/** The traits.check handler, delegating to the shared workspace checker. */
export const layer = toolkit.toLayer(
  Effect.gen(function* () {
    const { check } = yield* WorkspaceCheck.WorkspaceCheck
    return {
      "traits.check": (parameters) =>
        check(parameters).pipe(
          Effect.mapError((error) => TraitsCheckFailure.make({ message: error.message })),
          // Without this, the client sees only a generic internal error and cannot act on it.
          Effect.catchDefect((defect) =>
            TraitsCheckFailure.make({
              message: `The check stopped on an unexpected error, so its results are incomplete and it is not a pass. Report this to the user:\n${Cause.pretty(Cause.die(defect))}`
            })
          )
        )
    }
  })
)
