import { Schema as S } from "effect"

import { WorkspacePath } from "../util/util.ts"

/** Where the host loaded a trait definition from; further kinds, such as remote or registry traits, may be added as cases. */
export type TraitOrigin = typeof TraitOrigin.Type
export const TraitOrigin = S.TaggedUnion({
  /** A trait file in the workspace. */
  File: {
    /** Workspace path of the trait's definition file. */
    path: WorkspacePath.annotateKey({ description: "Workspace path of the trait's definition file." })
  }
}).annotate({
  description:
    "Where the host loaded a trait definition from; further kinds, such as remote or registry traits, may be added as cases."
})
