import { Context, Semaphore } from "effect"

export class TraitsContext extends Context.Service<
  TraitsContext,
  {
    readonly configRoot: string
    readonly excludeGitignored: boolean
    readonly excludes: ReadonlyArray<string>
    readonly semaphore: Semaphore.Semaphore
  }
>()("traits/TraitsContext") {}
