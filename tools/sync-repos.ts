import { Array, Console, Data, Effect, FileSystem, Path } from "effect"
import { Command } from "effect/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

class RepoSyncError extends Data.TaggedError("RepoSyncError")<{ readonly message: string }> {}

export const syncRepos = Command.make("sync-repos").pipe(
  Command.withHandler(
    Effect.fn("tools.syncRepos")(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const reposDir = path.join(process.cwd(), "repos")

      yield* ChildProcess.make`git submodule update --init -- repos`.pipe(
        (command) => spawner.exitCode(command),
        Effect.filterOrFail(
          (exitCode) => exitCode === 0,
          () => new RepoSyncError({ message: "Failed to initialize reference repositories" })
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
        Effect.fn("tools.syncRepos.organization")(function* (org) {
          const orgDir = path.join(reposDir, org)
          const entries = yield* fs.readDirectory(orgDir)

          const repoNames = yield* Effect.filter(
            entries,
            (entry) => fs.stat(path.join(orgDir, entry)).pipe(Effect.map((info) => info.type === "Directory")),
            { concurrency: "unbounded" }
          )

          return repoNames.map((repo) => ({
            entry: `${org}/${repo}`,
            repoDir: path.join(orgDir, repo)
          }))
        }),
        { concurrency: "unbounded" }
      ).pipe(Effect.map(Array.flatten))

      yield* Effect.forEach(
        repos,
        Effect.fn("tools.syncRepos.repository")(function* ({ entry, repoDir }) {
          yield* Console.log(`Syncing "${entry}" (main)`)
          yield* ChildProcess.make`git fetch origin main`.pipe(
            ChildProcess.setCwd(repoDir),
            (command) => spawner.exitCode(command),
            Effect.filterOrFail(
              (exitCode) => exitCode === 0,
              () => new RepoSyncError({ message: `Failed to fetch "${entry}"` })
            )
          )
          yield* ChildProcess.make`git switch -C main origin/main`.pipe(
            ChildProcess.setCwd(repoDir),
            (command) => spawner.exitCode(command),
            Effect.filterOrFail(
              (exitCode) => exitCode === 0,
              () => new RepoSyncError({ message: `Failed to switch "${entry}" to main` })
            )
          )
          yield* Console.log(`Synced "${entry}" (main)`)
        }),
        { concurrency: "unbounded" }
      )
    })
  )
)
