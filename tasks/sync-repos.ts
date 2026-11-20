import { Array, Console, Effect, FileSystem, Path } from "effect"
import { CliError, Command, Flag } from "effect/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

export const syncRepos = Command.make("sync-repos", {
  entryConcurrency: Flag.Int("entry-concurrency").pipe(
    Flag.withDefault(16),
    Flag.withDescription("Directory entries inspected at once while finding repositories.")
  ),
  fetchConcurrency: Flag.Int("fetch-concurrency").pipe(
    Flag.withDefault(4),
    Flag.withDescription("Repositories synced at once; each runs Git processes with network connections.")
  )
}).pipe(
  Command.withHandler(
    Effect.fn("tasks.syncRepos")(function* (params) {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const reposDir = path.resolve("repos")

      yield* ChildProcess.make`git submodule update --init -- repos`.pipe(
        (command) => spawner.exitCode(command),
        Effect.filterOrFail(
          (exitCode) => exitCode === 0,
          () => CliError.UserError.make({ cause: "Failed to initialize reference repositories" })
        )
      )

      const orgs = yield* fs
        .readDirectory(reposDir)
        .pipe(
          Effect.flatMap((entries) =>
            Effect.filter(
              entries,
              (entry) => fs.stat(path.join(reposDir, entry)).pipe(Effect.map((info) => info.type === "Directory")),
              { concurrency: params.entryConcurrency }
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
            { concurrency: params.entryConcurrency }
          )

          return Array.map(repoNames, (repo) => ({
            entry: `${org}/${repo}`,
            repoDir: path.join(orgDir, repo)
          }))
        }),
        { concurrency: params.entryConcurrency }
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
              () => CliError.UserError.make({ cause: `Failed to fetch "${repo.entry}"` })
            )
          )
          yield* ChildProcess.make`git switch -C main origin/main`.pipe(
            ChildProcess.setCwd(repo.repoDir),
            (command) => spawner.exitCode(command),
            Effect.filterOrFail(
              (exitCode) => exitCode === 0,
              () => CliError.UserError.make({ cause: `Failed to switch "${repo.entry}" to main` })
            )
          )
          yield* Console.log(`Synced "${repo.entry}" (main)`)
        }),
        { concurrency: params.fetchConcurrency }
      )
    })
  )
)
