import { Schema as S } from "effect"

import { InputRange } from "./InputRange.ts"

/** A whole-file or ranged location in either side of a snapshot change. */
export type SnapshotChangeLocation = typeof SnapshotChangeLocation.Type
export const SnapshotChangeLocation = S.Struct({
  /** The path in the referenced snapshot. */
  path: S.NonEmptyString,
  /** The snapshot containing the evaluated material. */
  snapshot: S.Literals(["current", "previous"]),
  /** Zero-based UTF-16 offsets with an exclusive end; omitted for the whole snapshot. */
  range: InputRange.pipe(S.optionalKey)
})
