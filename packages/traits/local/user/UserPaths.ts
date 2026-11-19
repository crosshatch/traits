import { Context, Effect, FileSystem, Layer, Path, pipe, Schema as S, String } from "effect"
import { UserDirectories } from "effect/persistence"

import * as Git from "../Git.ts"

/** Git could not resolve the workspace's common directory from the invocation directory. */
export class WorkspaceGitError extends S.TaggedError<WorkspaceGitError>()("WorkspaceGitError", {
  /** Invocation directory whose Git workspace lookup failed. */
  cwd: S.String.annotateKey({ description: "Invocation directory whose Git workspace lookup failed." }),
  /** Nonzero exit code returned by Git. */
  exitCode: S.Int.annotateKey({ description: "Nonzero exit code returned by Git." }),
  /** Git diagnostics explaining why repository discovery failed. */
  stderr: S.String.annotateKey({ description: "Git diagnostics explaining why repository discovery failed." })
}) {
  override get message() {
    return `Could not resolve the Git common directory from ${this.cwd} (git exited with ${this.exitCode}): ${this.stderr}`
  }
}

/** User-level filesystem locations for profiles, accounts, and their lock, and the key that selects the current workspace's profile. */
export class UserPaths extends Context.Service<UserPaths>()("traits/local/user/UserPaths", {
  make: Effect.gen(function* () {
    const path = yield* Path.Path
    const fs = yield* FileSystem.FileSystem
    const cwd = path.resolve()
    const canonicalCwd = yield* fs.realPath(cwd)
    const { exitCode, stdout, stderr } = yield* Git.commonDirectory(cwd)
    const outsideGit = exitCode === 128 && pipe(stderr, String.startsWith("fatal: not a git repository (or any "))
    if (exitCode !== 0 && !outsideGit) {
      return yield* WorkspaceGitError.make({ cwd, exitCode, stderr: String.trim(stderr) })
    }
    const workspaceKey = outsideGit
      ? canonicalCwd
      : yield* pipe(stdout, String.trim, S.decodeEffect(S.NonEmptyString), Effect.flatMap(fs.realPath))
    const { config, data } = yield* UserDirectories.UserDirectories
    const { configDirectory, dataDirectory } = yield* Effect.all(
      {
        configDirectory: config("traits"),
        dataDirectory: data("traits")
      },
      { concurrency: "unbounded" }
    )
    return {
      /** Profile-selection key: canonical Git common directory shared by worktrees, or canonical cwd outside Git. */
      workspaceKey,
      /** Platform-native user data directory for traits. */
      dataDirectory,
      /** User-level profiles.json file containing profiles and workspace overrides. */
      config: path.join(configDirectory, "profiles.json"),
      /** User-level credentials.json file containing saved provider accounts and secrets. */
      accounts: path.join(dataDirectory, "credentials.json"),
      /** Persistent cli.lock file used for native locking; never unlink or replace it. */
      lock: path.join(dataDirectory, "cli.lock")
    }
  })
}) {
  static readonly layer = this.make.pipe(Layer.effect(this))
}
