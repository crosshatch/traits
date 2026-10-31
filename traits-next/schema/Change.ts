import { Schema as S } from "effect"

import { InputSource } from "./InputSource.ts"

/** Before and after source versions, with at least one version present. */
export type Change = typeof Change.Type
export const Change = S.Union([
  S.Struct({
    /** The source before the change. */
    before: InputSource,
    /** The source after the change; absent for deletions. */
    after: InputSource.pipe(S.optionalKey)
  }),
  S.Struct({
    /** The source before the change; absent for creations. */
    before: InputSource.pipe(S.optionalKey),
    /** The source after the change. */
    after: InputSource
  })
])
