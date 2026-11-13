import { Cause, Effect, FileSystem, Fiber, Option, Path, pipe, Ref, Schema as S, String } from "effect"
import { Tool, Toolkit } from "effect/ai"

import * as Changelog from "../local/Changelog.ts"
import * as WorkspaceCheck from "../local/WorkspaceCheck.ts"
import { EnvironmentName } from "../local/WorkspaceTraits.ts"
import PackageJson from "../package.json" with { type: "json" }
import { Report } from "../Report/Report.ts"
import { TraitName } from "../TraitName.ts"
import * as Version from "../Version.ts"
import * as ToolFailure from "./ToolFailure.ts"

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
    |Returns the full report, and sometimes a notice about a newer traits release or a needed server restart; relay any notice to the user. The report gives, for each trait and file, the targets with their subject-match and pass, fail, na, and uncertain probabilities, plus any failures that prevented complete checking.
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
  success: S.Struct({
    /** The full check report. */
    report: Report.annotateKey({ description: "The full check report." }),
    /** A newer traits release, or a server restart the upgraded package needs, to relay to the user; absent when there is none. */
    notice: S.String.annotateKey({
      description:
        "A newer traits release, or a server restart the upgraded package needs, to relay to the user; absent when there is none."
    }).pipe(S.optionalKey)
  }),
  failure: TraitsCheckFailure,
  failureMode: "return"
})
  .annotate(Tool.Title, "Check Traits")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)

/** The traits.check toolkit. */
export const toolkit = Toolkit.make(TraitsCheck)

/** The traits.check handler, delegating to the shared workspace checker and adding release and restart notices. */
export const layer = toolkit.toLayer(
  Effect.gen(function* () {
    const { check } = yield* WorkspaceCheck.WorkspaceCheck
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    // Looked up once per server, starting now so checks rarely wait; a failed or slow lookup gives no notice.
    const latest = yield* Changelog.latestVersion.pipe(
      Effect.timeoutOption("3 seconds"),
      Effect.orElseSucceed(() => Option.none<string>()),
      Effect.forkScoped
    )
    const announced = yield* Ref.make(false)
    // The package.json beside this module; upgrading the package replaces it while this server keeps running.
    const manifest = yield* path.fromFileUrl(new URL("../package.json", import.meta.url)).pipe(Effect.orDie)
    const notice = Effect.gen(function* () {
      const installed = yield* fs
        .readFileString(manifest)
        .pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(S.Struct({ version: Version.Version })))), Effect.option)
      if (Option.isSome(installed) && installed.value.version !== PackageJson.version) {
        return Option.some(
          `traits ${installed.value.version} is now installed, but this MCP server is still running ${PackageJson.version}, so checks use the old version. Ask the user to restart the traits MCP server, then run \`traits update\` if the workspace needs migrating.`
        )
      }
      const newer = yield* Fiber.join(latest).pipe(
        Effect.map(Option.filter((version) => Version.isNewer(version, PackageJson.version)))
      )
      // A release is announced once per server, so it does not repeat in every result.
      if (Option.isNone(newer) || (yield* Ref.getAndSet(announced, true))) {
        return Option.none<string>()
      }
      return Option.some(
        `traits ${newer.value} is available; this workspace runs ${PackageJson.version}. Tell the user. If they want to upgrade, update the traits package with the workspace's package manager, restart the traits MCP server, then run \`traits update\` and follow its migration steps.`
      )
    })
    return {
      "traits.check": (parameters) =>
        check(parameters).pipe(
          // Every failure, expected or not, reaches the client serialized; otherwise it sees only a generic internal error.
          Effect.catchCause((cause) =>
            Cause.hasInterruptsOnly(cause)
              ? Effect.interrupt
              : TraitsCheckFailure.make({
                  message: ToolFailure.describe(cause, {
                    outcome: "The check did not finish, so it is neither a pass nor a finding.",
                    recovery:
                      "Once it is fixed, run the same check again; configuration and trait files are reloaded on every call, so no restart is needed."
                  })
                })
          ),
          Effect.matchEffect({
            onSuccess: (report) =>
              Effect.map(notice, (found) => (Option.isSome(found) ? { report, notice: found.value } : { report })),
            onFailure: (failure) =>
              Effect.flatMap(notice, (found) =>
                Option.isSome(found)
                  ? TraitsCheckFailure.make({ message: `${failure.message}\n\n${found.value}` })
                  : Effect.fail(failure)
              )
          })
        )
    }
  })
)
