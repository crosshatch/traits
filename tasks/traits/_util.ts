import { Effect } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

export const git = Effect.fn("traits.git")(function* (args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  return yield* spawner.string(
    ChildProcess.make("git", ["--literal-pathspecs", ...args], {
      stdin: "ignore"
    })
  )
})
