import { Schema as S } from "effect"

/** Whether the evaluated path and range address before or after content; not a revision identifier. */
export type InputSide = typeof InputSide.Type
export const InputSide = S.Literals(["before", "after"]).annotate({
  description: "Whether the evaluated path and range address before or after content; not a revision identifier."
})
