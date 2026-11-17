import { Effect, Schema as S } from "effect"

import { GitHub } from "./GitHub.ts"
import { pageQuery } from "./pageQuery.ts"

export const listPulls = Effect.fn("github.listPulls")(function* (page: number, state: "open" | "closed") {
  const github = yield* GitHub
  const query = yield* S.encodeEffect(pageQuery)({ page, per_page: 50 })
  return yield* github.request("GET", "/pulls", { query: { ...query, state } })
})
