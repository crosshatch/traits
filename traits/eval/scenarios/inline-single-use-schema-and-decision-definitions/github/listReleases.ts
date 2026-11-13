import { Effect, Schema as S } from "effect"

import { GitHub } from "./GitHub.ts"
import { pageQuery } from "./pageQuery.ts"

export const listReleases = Effect.fn("github.listReleases")(function* (page: number) {
  const github = yield* GitHub
  const query = yield* S.encodeEffect(pageQuery)({ page, per_page: 20 })
  return yield* github.request("GET", "/releases", { query })
})
