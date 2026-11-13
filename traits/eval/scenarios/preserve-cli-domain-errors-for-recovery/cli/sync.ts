import { Console, Effect } from "effect"
import { Command, Flag } from "effect/cli"

import { Git } from "./Git.ts"
import { PushRejected, pushHandler } from "./push.ts"

export const sync = Command.make(
  "sync",
  { remote: Flag.String("remote").pipe(Flag.withDefault("origin")), branch: Flag.String("branch") },
  Effect.fn("sync")(function* (params) {
    const git = yield* Git
    yield* pushHandler(params).pipe(
      Effect.catchIf(
        (error) => error.cause instanceof PushRejected,
        () =>
          Console.log(`Remote moved ahead; rebasing ${params.branch} and retrying.`).pipe(
            Effect.andThen(git.rebaseOnto(params.remote, params.branch)),
            Effect.andThen(pushHandler(params))
          )
      )
    )
  })
).pipe(Command.withDescription("Push a branch, rebasing first when the remote moved ahead"))
