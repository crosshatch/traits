import { Runtime, Schema as S } from "effect"

/** Ends a command with an exit code, without the runtime reporting it as a failure of its own: 1 when the command did its work and found something wrong, and 2 when it could not do its work. Where there is a reason to give, it is printed before the command ends. */
export class CommandExit extends S.TaggedError<CommandExit>()("CommandExit", {
  /** 1 when the command did its work and found something wrong; 2 when it could not do its work. */
  code: S.Literals([1, 2]).annotateKey({
    description: "1 when the command did its work and found something wrong; 2 when it could not do its work."
  }),
  /** Why the command ends this way, for the user; omitted when its output has already said. */
  reason: S.String.annotateKey({
    description: "Why the command ends this way, for the user; omitted when its output has already said."
  }).pipe(S.optionalKey)
}) {
  override readonly [Runtime.errorExitCode] = this.code
  override readonly [Runtime.errorReported] = false
}
