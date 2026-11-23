import { Effect, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"

/** Runs a command to completion in a directory, and returns what it printed and its exit code. The variables are added to the process's own environment. */
export const runProcess = Effect.fnUntraced(function* (options: {
  readonly command: string
  readonly args: ReadonlyArray<string>
  readonly cwd: string
  readonly env?: Readonly<Record<string, string>>
}) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const handle = yield* spawner.spawn(
    ChildProcess.make(options.command, options.args, { cwd: options.cwd, env: options.env ?? {}, extendEnv: true })
  )
  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(handle.stdout)),
      Stream.mkString(Stream.decodeText(handle.stderr)),
      handle.exitCode
    ],
    { concurrency: "unbounded" }
  )
  return { stdout, stderr, exitCode }
}, Effect.scoped)
