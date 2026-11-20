import { Effect, Schema as S } from "effect"

import { GitHub } from "./GitHub.ts"
import { labelRequest } from "./labelRequest.ts"

export const addLabels = Effect.fn("github.addLabels")(function* (issue: number, labels: ReadonlyArray<string>) {
  const github = yield* GitHub
  const body = yield* S.encodeEffect(labelRequest)({ labels })
  return yield* github.request("POST", `/issues/${issue}/labels`, { body })
})
