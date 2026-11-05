import { Schema as S } from "effect"

/** Input execution state, independent of assessment acceptance: Completed finished required work, Failed could not finish, and Cancelled was stopped before completion. */
export type InputStatus = typeof InputStatus.Type
export const InputStatus = S.Literals(["Completed", "Failed", "Cancelled"]).annotate({
  description:
    "Input execution state, independent of assessment acceptance: Completed finished required work, Failed could not finish, and Cancelled was stopped before completion."
})
