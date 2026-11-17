import { Console, Effect, Schema as S } from "effect"
import { CliError, Command, Flag } from "effect/cli"

import { Git } from "./Git.ts"

export class PullConflict extends S.TaggedError<PullConflict>()("PullConflict", {
  remote: S.String,
  branch: S.String,
  detail: S.String
}) {}

export const pullHandler = Effect.fn("pull")(
  function* (params: { readonly remote: string; readonly branch: string }) {
    const git = yield* Git
    const result = yield* git.pull(params.remote, params.branch)
    if (!result.accepted) {
      return yield* PullConflict.make({ ...params, detail: result.detail })
    }
    yield* Console.log(`Pulled ${params.branch} from ${params.remote}.`)
  },
  Effect.mapError((error) =>
    CliError.UserError.make({
      cause: error,
      userMessage: `${error.branch} conflicts with ${error.remote}: ${error.detail}`
    })
  )
)

export const pull = Command.make(
  "pull",
  { remote: Flag.String("remote").pipe(Flag.withDefault("origin")), branch: Flag.String("branch") },
  pullHandler
).pipe(Command.withDescription("Pull a branch"))
