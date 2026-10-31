import { Schema as S } from "effect"

/** Whether the evaluated source is from before or after a change. */
export type InputSide = typeof InputSide.Type
export const InputSide = S.Literals(["before", "after"])
