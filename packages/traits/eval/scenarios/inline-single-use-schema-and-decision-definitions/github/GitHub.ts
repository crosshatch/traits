import { Context, Effect } from "effect"

export class GitHub extends Context.Service<
  GitHub,
  {
    readonly request: (
      method: "GET" | "POST" | "DELETE",
      path: string,
      options?: { readonly query?: Readonly<Record<string, unknown>>; readonly body?: unknown }
    ) => Effect.Effect<unknown>
  }
>()("github/GitHub") {}
