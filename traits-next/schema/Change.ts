import { Schema as S } from "effect"

import { InputSource } from "./InputSource.ts"

/** At least one before or after source: after-only is creation, before-only is deletion, and both represent an update or rename. */
export type Change = typeof Change.Type
export const Change = S.Union([
  S.Struct({
    /** The source before the change, with its original path. */
    before: InputSource.annotate({ description: "The source before the change, with its original path." }),
    /** The source after the change; absent for deletions. */
    after: InputSource.annotate({ description: "The source after the change; absent for deletions." }).pipe(
      S.optionalKey
    )
  }),
  S.Struct({
    /** The source before the change; absent for creations. */
    before: InputSource.annotate({ description: "The source before the change; absent for creations." }).pipe(
      S.optionalKey
    ),
    /** The source after the change, with its current path. */
    after: InputSource.annotate({ description: "The source after the change, with its current path." })
  })
]).annotate({
  description:
    "At least one before or after source: after-only is creation, before-only is deletion, and both represent an update or rename."
})
