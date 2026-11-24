import { Runtime, Schema as S } from "effect"
import { CliError } from "effect/cli"

/** Ends a command that did its work, and whose output has already said what came of it, with an exit code, without the runtime reporting it as a failure of its own: 1 when it found something wrong, and 2 when there was something it could not assess. */
export class CommandExit extends S.TaggedError<CommandExit>()("CommandExit", {
  /** 1 when the command found something wrong; 2 when there was something it could not assess. */
  code: S.Literals([1, 2]).annotateKey({
    description: "1 when the command found something wrong; 2 when there was something it could not assess."
  })
}) {
  override readonly [Runtime.errorExitCode] = this.code
  override readonly [Runtime.errorReported] = false
}

/** Ends a command that could not do its work, with exit code 2. Command.run prints the reason as it prints the command line's own errors. */
export class CommandFailed extends S.TaggedError<CommandFailed>()("CommandFailed", {
  /** Why the command could not do its work, for the user. */
  reason: S.String.annotateKey({ description: "Why the command could not do its work, for the user." })
}) {
  override readonly [Runtime.errorExitCode] = 2

  override get [CliError.userMessage]() {
    return this.reason
  }
}
