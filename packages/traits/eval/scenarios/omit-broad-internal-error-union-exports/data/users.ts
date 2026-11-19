import { Effect } from "effect"

import { Repository } from "./Repository.ts"

export const renameUser = Effect.fn("users.rename")(function* (id: string, name: string) {
  const repository = yield* Repository
  const user = yield* repository.get(`user:${id}`)
  yield* repository.put({ ...user, version: user.version + 1, data: { ...(user.data as object), name } })
})

export const deleteUser = Effect.fn("users.delete")(function* (id: string) {
  const repository = yield* Repository
  const user = yield* repository.get(`user:${id}`)
  yield* repository.remove(user.id, user.version)
}, Effect.catchTag("RecordNotFound", () => Effect.void))
