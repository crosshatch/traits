import { Context, Effect } from "effect"

export interface RemoteResult {
  readonly accepted: boolean
  readonly detail: string
}

export class Git extends Context.Service<
  Git,
  {
    readonly push: (remote: string, branch: string) => Effect.Effect<RemoteResult>
    readonly pull: (remote: string, branch: string) => Effect.Effect<RemoteResult>
    readonly rebaseOnto: (remote: string, branch: string) => Effect.Effect<void>
  }
>()("cli/Git") {}
