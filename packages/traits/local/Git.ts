import { Effect, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

/** Runs git in a directory and collects its exit code and decoded output. A nonzero exit is a result rather than a failure, since callers read it differently; messages are in the C locale so they can be matched. */
export const run = Effect.fn("Git.run")(function* (directory: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const handle = yield* spawner.spawn(
    ChildProcess.make("git", args, {
      cwd: directory,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      env: { LC_ALL: "C" },
      extendEnv: true
    })
  )
  return yield* Effect.all(
    {
      exitCode: handle.exitCode,
      stdout: handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
      stderr: handle.stderr.pipe(Stream.decodeText(), Stream.mkString)
    },
    { concurrency: "unbounded" }
  )
}, Effect.scoped)

/** Asks git for the repository's common directory, which linked worktrees share, as an absolute path on stdout. */
export const commonDirectory = (directory: string) =>
  run(directory, ["rev-parse", "--path-format=absolute", "--git-common-dir"])
