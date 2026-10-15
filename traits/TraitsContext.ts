import { Context, Semaphore } from "effect"

import type { TraitsConfig } from "./TraitsConfig.ts"

export class TraitsContext extends Context.Service<
  TraitsContext,
  {
    readonly configRoot: string
    readonly config: typeof TraitsConfig.Type
    readonly excludes: ReadonlyArray<string>
    readonly semaphore: Semaphore.Semaphore
  }
>()("traits/TraitsContext") {}
