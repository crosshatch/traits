import { Schema as S } from "effect"

export type Source = typeof Source.Type
export const Source = S.Struct({
  agentId: S.String,
  text: S.String,
  location: S.optional(
    S.TaggedUnion({
      File: { path: S.String, startLine: S.Int },
      Generated: {}
    })
  )
})
