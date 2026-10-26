import { Array, Console, Effect, FileSystem, Path, Schema as S } from "effect"
import { Command } from "effect/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

class RepoInitializationError extends S.TaggedError<RepoInitializationError>()("RepoInitializationError", {}) {
  override get message() {
    return "Failed to initialize reference repositories"
  }
}

class RepoFetchError extends S.TaggedError<RepoFetchError>()("RepoFetchError", {
  repository: S.String
}) {
  override get message() {
    return `Failed to fetch "${this.repository}"`
  }
}

class RepoSwitchError extends S.TaggedError<RepoSwitchError>()("RepoSwitchError", {
  repository: S.String
}) {
  override get message() {
    return `Failed to switch "${this.repository}" to main`
  }
}

export const syncRepos = Command.make("sync-repos").pipe(
  Command.withHandler(
    Effect.fn("tasks.syncRepos")(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const reposDir = path.resolve("repos")

      yield* ChildProcess.make`git submodule update --init -- repos`.pipe(
        (command) => spawner.exitCode(command),
        Effect.filterOrFail(
          (exitCode) => exitCode === 0,
          () => RepoInitializationError.make({})
        )
      )

      const orgs = yield* fs
        .readDirectory(reposDir)
        .pipe(
          Effect.flatMap((entries) =>
            Effect.filter(
              entries,
              (entry) => fs.stat(path.join(reposDir, entry)).pipe(Effect.map((info) => info.type === "Directory")),
              { concurrency: "unbounded" }
            )
          )
        )

      const repos = yield* Effect.forEach(
        orgs,
        Effect.fn("tasks.syncRepos.organization")(function* (org) {
          const orgDir = path.join(reposDir, org)
          const entries = yield* fs.readDirectory(orgDir)

          const repoNames = yield* Effect.filter(
            entries,
            (entry) => fs.stat(path.join(orgDir, entry)).pipe(Effect.map((info) => info.type === "Directory")),
            { concurrency: "unbounded" }
          )

          return Array.map(repoNames, (repo) => ({
            entry: `${org}/${repo}`,
            repoDir: path.join(orgDir, repo)
          }))
        }),
        { concurrency: "unbounded" }
      ).pipe(Effect.map(Array.flatten))

      yield* Effect.forEach(
        repos,
        Effect.fn("tasks.syncRepos.repository")(function* (repo) {
          yield* Console.log(`Syncing "${repo.entry}" (main)`)
          yield* ChildProcess.make`git fetch origin main`.pipe(
            ChildProcess.setCwd(repo.repoDir),
            (command) => spawner.exitCode(command),
            Effect.filterOrFail(
              (exitCode) => exitCode === 0,
              () => RepoFetchError.make({ repository: repo.entry })
            )
          )
          yield* ChildProcess.make`git switch -C main origin/main`.pipe(
            ChildProcess.setCwd(repo.repoDir),
            (command) => spawner.exitCode(command),
            Effect.filterOrFail(
              (exitCode) => exitCode === 0,
              () => RepoSwitchError.make({ repository: repo.entry })
            )
          )
          yield* Console.log(`Synced "${repo.entry}" (main)`)
        }),
        { concurrency: "unbounded" }
      )
    })
  )
)
