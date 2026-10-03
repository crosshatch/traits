import { Effect, FileSystem, Path, Schema } from "effect"
import { Command } from "effect/cli"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

class MigrationGenerationError extends Schema.TaggedError<MigrationGenerationError>()("MigrationGenerationError", {
  schema: Schema.String,
  exitCode: Schema.Int
}) {}

export const generateMigrations = Command.make("generate-migrations").pipe(
  Command.withHandler(
    Effect.fn("tools.generateMigrations")(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const schemas = yield* fs.glob("crosshatch.dev/src/*/schema.ts")

      yield* Effect.forEach(
        schemas,
        Effect.fn("tools.generateMigrations.schema")(function* (schema) {
          yield* Effect.log(`Generating migrations for ${schema}`)
          const exitCode = yield* spawner.exitCode(
            ChildProcess.make(
              "pnpm",
              [
                "--dir",
                "crosshatch.dev",
                "exec",
                "drizzle-kit",
                "generate",
                "--dialect",
                "sqlite",
                "--schema",
                path.relative("crosshatch.dev", schema),
                "--out",
                path.relative("crosshatch.dev", path.join(path.dirname(schema), "migrations"))
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
