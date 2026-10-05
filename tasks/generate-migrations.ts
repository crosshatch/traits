import { Effect, FileSystem, Path, Schema as S } from "effect"
import { Command } from "effect/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

class MigrationGenerationError extends S.TaggedError<MigrationGenerationError>()("MigrationGenerationError", {
  schema: S.String,
  exitCode: S.Int
}) {}

export const generateMigrations = Command.make("generate-migrations").pipe(
  Command.withHandler(
    Effect.fn("tasks.generateMigrations")(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const schemas = yield* fs.glob("crosshatch.dev/src/*/schema.ts")

      yield* Effect.forEach(
        schemas,
        Effect.fn("tasks.generateMigrations.schema")(function* (schema) {
          yield* Effect.log(`Generating migrations for ${schema}`)
          const exitCode = yield* spawner.exitCode(
            ChildProcess.make(
              "pnpm",
              [
                "exec",
                "drizzle-kit",
                "generate",
                "--dialect",
                "sqlite",
                "--schema",
                schema,
                "--out",
                path.join(path.dirname(schema), "migrations")
              ],
              { stdin: "inherit", stdout: "inherit", stderr: "inherit" }
            )
          )

          if (exitCode !== 0) {
            return yield* MigrationGenerationError.make({ schema, exitCode })
          }
        }),
        { concurrency: "unbounded", discard: true }
      )
    })
  )
)
