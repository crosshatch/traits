import { Effect, FileSystem, Path, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

import { GitRootUnavailable } from "./errors.ts"

export interface CaptureGroup {
  readonly project: string
  readonly state: string
  readonly worktree: string
}

export const resolveProject = Effect.fn("Project.resolve")(function* (directory: string = ".") {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const cwd = yield* fs.realPath(path.resolve(directory))
  const git = (args: ReadonlyArray<string>) =>
    spawner.string(ChildProcess.make("git", ["-C", cwd, ...args], { stderr: "ignore" })).pipe(
      Effect.map(String.trim),
      Effect.filterOrFail(String.isNonEmpty, (stdout) =>
        GitRootUnavailable.make({ directory: cwd, command: ["git", "-C", cwd, ...args], stdout })
      )
    )
  const worktree = yield* git(["rev-parse", "--show-toplevel"]).pipe(Effect.orElseSucceed(() => cwd))
  const project = yield* git(["rev-parse", "--path-format=absolute", "--git-common-dir"]).pipe(
    Effect.map(path.dirname),
    Effect.orElseSucceed(() => cwd)
  )
  const state = path.join(worktree, ".agents", "otel")
  yield* fs.makeDirectory(state, { recursive: true })
  const ignore = path.join(state, ".gitignore")
  if (!(yield* fs.exists(ignore))) yield* fs.writeFileString(ignore, "*\n")
  return { project, worktree, state } satisfies CaptureGroup
})
