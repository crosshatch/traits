import type { Change } from "../schema/index.ts"
import type { Trait } from "../Trait.ts"

/** Caller-ordered traits and text changes; traits must contain canonical extension references. */
export interface CheckInput {
  /** Static trait definitions in report order, with canonical extension references. */
  readonly traits: ReadonlyArray<Trait>
  /** Text snapshots in caller order; report change indices refer to this array. */
  readonly changes: ReadonlyArray<Change>
}
