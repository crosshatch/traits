import { Effect, pipe, Schema as S } from "effect"

import type { InputSource } from "../util/InputSource.ts"
import { digestText, TextDigest } from "../util/TextDigest.ts"
import { WorkspacePath } from "../util/WorkspacePath.ts"

/** One supplied source version identified by its workspace path and text digest, without retaining its text. */
export type SourceIdentity = typeof SourceIdentity.Type
export const SourceIdentity = S.Struct({
  /** Workspace-relative path of this source version; before and after paths differ for renames. */
  path: WorkspacePath.annotateKey({
    description: "Workspace-relative path of this source version; before and after paths differ for renames."
  }),
  /** Digest of the exact supplied text; compare it with the current text before mapping report ranges onto a file. */
  digest: TextDigest.annotateKey({
    description:
      "Digest of the exact supplied text; compare it with the current text before mapping report ranges onto a file."
  })
}).annotate({
  description:
    "One supplied source version identified by its workspace path and text digest, without retaining its text."
})

/** Identifies a supplied source version by its path and the digest of its text. */
export const fromInputSource = (source: InputSource) =>
  pipe(
    source.text,
    digestText,
    Effect.map((digest) => SourceIdentity.make({ path: source.path, digest }))
  )
