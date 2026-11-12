import { Effect, Schema as S } from "effect"

import { GitHub } from "./GitHub.ts"
import { pageQuery } from "./pageQuery.ts"

export const listIssues = Effect.fn("github.listIssues")(function* (page: number) {
  const github = yield* GitHub
  const query = yield* S.encodeEffect(pageQuery)({ page, per_page: 100 })
  return yield* github.request("GET", "/issues", { query })
})
