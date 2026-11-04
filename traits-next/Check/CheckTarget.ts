import type { Input } from "../schema/index.ts"

/** A selected source input paired with its original change index. */
export interface CheckTarget {
  readonly change: number
  readonly input: Input
}
