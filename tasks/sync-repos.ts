import { Array, Console, Data, Effect, FileSystem, Path } from "effect"
import { Command } from "effect/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

class RepoInitializationError extends Data.TaggedError("RepoInitializationError") {
  override get message() {
    return "Failed to initialize reference repositories"
  }
}

class RepoFetchError extends Data.TaggedError("RepoFetchError")<{ readonly repository: string }> {
  override get message() {
    return `Failed to fetch "${this.repository}"`
  }
}

class RepoSwitchError extends Data.TaggedError("RepoSwitchError")<{ readonly repository: string }> {
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
          () => new RepoInitializationError()
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
              () => new RepoFetchError({ repository: repo.entry })
            )
          )
          yield* ChildProcess.make`git switch -C main origin/main`.pipe(
            ChildProcess.setCwd(repo.repoDir),
            (command) => spawner.exitCode(command),
            Effect.filterOrFail(
              (exitCode) => exitCode === 0,
              () => new RepoSwitchError({ repository: repo.entry })
            )
          )
          yield* Console.log(`Synced "${repo.entry}" (main)`)
        }),
        { concurrency: "unbounded" }
      )
    })
  )
)
