import { Array, Console, Effect, FileSystem, Path } from "effect"
import { Command, Flag } from "effect/cli"

/** Never descend into nested worktrees or Git metadata. */
const alwaysIgnore = ["**/.git", "**/.worktrees"]

export const clean = Command.make("clean", {
  ignore: Flag.String("ignore").pipe(Flag.atLeast(0)),
  concurrency: Flag.Int("concurrency").pipe(
    Flag.withDefault(8),
    Flag.withDescription(
      "Packages cleaned at once; the glob can match thousands of package.json files, and each removal walks a directory tree."
    )
  )
}).pipe(
  Command.withHandler(
    Effect.fn("tasks.clean")(function* (params) {
      const exclude = Array.appendAll(alwaysIgnore, params.ignore)

      const path = yield* Path.Path
      const fs = yield* FileSystem.FileSystem
      const packages = yield* fs.glob("**/package.json", { exclude })

      yield* Effect.forEach(
        packages,
        Effect.fn("tasks.clean.package")(function* (packageJsonPath: string) {
          const dir = path.dirname(packageJsonPath)

          yield* Console.log(`Cleaning "${dir}"`)
          yield* Effect.forEach(
            ["dist", "node_modules", "tsconfig.tsbuildinfo"],
            (entry) => fs.remove(path.join(dir, entry), { recursive: true, force: true }),
            // Three fixed entries per package.
            { concurrency: "unbounded" }
          )
        }),
        { concurrency: params.concurrency }
      )
    })
  )
)
