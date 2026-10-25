import { Array, Effect, Schema as S, Stdio } from "effect"
import { Argument, Command, Flag } from "effect/cli"

import * as Run from "../reflection/Run.ts"

export const run = Command.make(
  "run",
  {
    id: Flag.String("id").pipe(
      Flag.withSchema(S.NonEmptyString.check(S.isPattern(/\S/, { message: "Section ID must not be blank" }))),
      Flag.withDescription("Stable section ID identifying this script within the worktree")
    ),
    command: Argument.String("command").pipe(Argument.withSchema(S.NonEmptyString)),
    args: Argument.String("args").pipe(Argument.withSchema(S.NonEmptyString), Argument.variadic())
  },
  Effect.fnUntraced(function* (options) {
    const stdio = yield* Stdio.Stdio
    const args = yield* stdio.args
    const shell = !Array.contains(args, "--") && options.args.length === 0
    const result = yield* Run.run([options.command, ...options.args], shell, options.id)
    process.exitCode = result.exitCode
    if (result.signal !== null) process.kill(process.pid, result.signal)
  })
).pipe(Command.withDescription("Run a command with a local OTLP traces and logs receiver"))
