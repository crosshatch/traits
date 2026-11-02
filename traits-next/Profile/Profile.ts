import { Schema as S } from "effect"

import { ModelSelection } from "./ModelSelection.ts"

/** User-level model selections by role; contains account references rather than credentials. */
export type Profile = typeof Profile.Type
export const Profile = S.Struct({
  language: ModelSelection,
  embedding: ModelSelection,
  decision: ModelSelection
}).annotate({
  description: "User-level model selections by role; contains account references rather than credentials."
})
