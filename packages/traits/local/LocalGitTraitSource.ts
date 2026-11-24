import { Effect, FileSystem, Path, String } from "effect"

import { TraitCollectionUpdateError } from "../TraitCollection/TraitCollections.ts"
import type { GitTraitSource } from "../TraitCollection/TraitSource.ts"
import type { TraitSourceId } from "../TraitCollection/TraitSourceId.ts"
import { runProcess } from "../util/process/runProcess.ts"
import { LocalPaths } from "./LocalPaths.ts"

/** Runs Git from the workspace root and returns what it printed, failing with what it reported when it exits unsuccessfully. */
const git = (id: TraitSourceId, args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const paths = yield* LocalPaths
    const { exitCode, stderr, stdout } = yield* runProcess({
      command: "git",
      args,
      cwd: paths.root,
      // Git must fail rather than wait for credentials nobody can type.
      env: { GIT_TERMINAL_PROMPT: "0" }
    })
    if (exitCode !== 0) {
      return yield* TraitCollectionUpdateError.make({
        traitSourceId: id,
        problem: `Git could not fetch the source: ${String.trim(stderr)}`
      })
    }
    return stdout
  }).pipe(
    Effect.catchTag("PlatformError", (cause) =>
      TraitCollectionUpdateError.make({ traitSourceId: id, problem: "Git could not be run.", cause })
    )
  )

/** Checks out a Git source's commit in a temporary directory, and returns its directory of traits and the commit. The temporary directory is removed when the scope closes. */
export const checkout = Effect.fnUntraced(function* (id: TraitSourceId, source: GitTraitSource) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const repository = yield* fs.makeTempDirectoryScoped().pipe(
    Effect.mapError((cause) =>
      TraitCollectionUpdateError.make({
        traitSourceId: id,
        problem: "Could not create a temporary directory.",
        cause
      })
    )
  )
  const within = ["--git-dir", path.join(repository, ".git"), "--work-tree", repository]
  yield* git(id, ["init", "--quiet", repository])
  // Fetching a ref, rather than cloning a branch, also accepts a tag or a commit.
  yield* git(id, [...within, "fetch", "--quiet", "--depth", "1", "--", source.git, source.ref ?? "HEAD"])
  const revision = yield* git(id, [...within, "rev-parse", "FETCH_HEAD^{commit}"])
  yield* git(id, [...within, "checkout", "--quiet", "--detach", "FETCH_HEAD"])
  return { directory: path.join(repository, source.path), revision: String.trim(revision) }
})
