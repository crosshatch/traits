import { Console, Effect, Schema as S } from "effect"
import { CliError, Command, Flag } from "effect/cli"

import { Git } from "./Git.ts"

export class PushRejected extends S.TaggedError<PushRejected>()("PushRejected", {
  remote: S.String,
  branch: S.String,
  detail: S.String
}) {}

export const pushHandler = Effect.fn("push")(
  function* (params: { readonly remote: string; readonly branch: string }) {
    const git = yield* Git
    const result = yield* git.push(params.remote, params.branch)
    if (!result.accepted) {
      return yield* PushRejected.make({ ...params, detail: result.detail })
    }
    yield* Console.log(`Pushed ${params.branch} to ${params.remote}.`)
  },
  Effect.mapError((error) =>
    CliError.UserError.make({
      cause: error,
      userMessage: `${error.remote} rejected ${error.branch}: ${error.detail}`
    })
  )
)

export const push = Command.make(
  "push",
  { remote: Flag.String("remote").pipe(Flag.withDefault("origin")), branch: Flag.String("branch") },
  pushHandler
).pipe(Command.withDescription("Push a branch"))
