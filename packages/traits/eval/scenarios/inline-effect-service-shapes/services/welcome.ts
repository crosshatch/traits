import { Effect, Option } from "effect"

import { Cache } from "./Cache.ts"
import { Mailer } from "./Mailer.ts"
import { SessionStore } from "./SessionStore.ts"

export const welcome = Effect.fn("welcome")(function* (email: string) {
  const cache = yield* Cache
  const sessions = yield* SessionStore
  const mailer = yield* Mailer
  if (Option.isSome(yield* cache.get(`welcomed:${email}`))) {
    return
  }
  yield* mailer.send(email, "Welcome", "Thanks for signing up.")
  yield* cache.set(`welcomed:${email}`, "true")
  yield* sessions.set(email, new Date().toISOString())
})
