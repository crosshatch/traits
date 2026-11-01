import { Schema as S } from "effect"

import { TraitsLockEntry } from "./TraitsLockEntry.ts"

/** Workspace-scoped incremental evaluation records; persistence, scheduling, and reuse validation are runner responsibilities. */
export type TraitsLock = typeof TraitsLock.Type
export const TraitsLock = S.Struct({
  /** Lockfile format version; incompatible formats require explicit migration or rebuilding. */
  version: S.Literal(1).annotate({
    description: "Lockfile format version; incompatible formats require explicit migration or rebuilding."
  }),
  /** Trait/change evaluation records; assembly replaces matching identities rather than appending duplicate attempts. */
  entries: S.Array(TraitsLockEntry).annotate({
    description:
      "Trait/change evaluation records; assembly replaces matching identities rather than appending duplicate attempts."
  })
}).annotate({
  description:
    "Workspace-scoped incremental evaluation records; persistence, scheduling, and reuse validation are runner responsibilities."
})
