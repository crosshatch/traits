import { Effect, FileSystem, pipe, Schema as S } from "effect"
import { SecureRandom } from "effect/crypto"

import { EnvironmentName } from "../EnvironmentName.ts"
import { TraitName } from "../TraitName.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

/** Source hashes avoid unnecessary inference; installed hashes detect local edits independently. */
export type Remote = typeof Remote.Type
export const Remote = S.Struct({
  /** Immutable commit used for the most recent successful ingestion. */
  ref: S.String.annotateKey({
    description: "Immutable commit used for the most recent successful ingestion; absent for ordinary URLs."
  }).pipe(S.optionalKey),
  /** Moving reference to resolve on the next pull. */
  branch: S.String.annotateKey({
    description: "Moving branch to resolve on the next pull; defaults to the repository default branch."
  }).pipe(S.optionalKey),
  /** Digest of the ordered source paths and decoded content. */
  hash: S.String.annotateKey({ description: "Digest of the ordered source paths and decoded content." }),
  /** Named selection receiving the source traits; omission is the default selection. */
  environment: EnvironmentName.annotateKey({
    description: "Named selection receiving the source traits; omission is the default selection."
  }).pipe(S.optionalKey),
  /** Whether future pulls traverse all directory descendants. */
  deep: S.Boolean.annotateKey({ description: "Whether future pulls traverse all directory descendants." }),
  /** Whether any source file required model inference. */
  extracted: S.Boolean.annotateKey({ description: "Whether any source file required model inference." }),
  /** Per-file provenance for reusing unchanged inferred traits. */
  files: S.Record(
    S.String,
    S.Struct({
      hash: S.String.annotateKey({ description: "Digest of this source file's decoded text." }),
      extracted: S.Boolean.annotateKey({ description: "Whether this file required inference." }),
      traits: S.Array(TraitName).annotateKey({ description: "Trait names produced by this file." })
    })
  ),
  /** Baseline digests for detecting local edits to installed traits. */
  installed: S.Record(TraitName, S.String).annotateKey({
    description: "Baseline digests for detecting local edits to installed traits."
  })
})
/** Tracked remote references and the provenance needed to refresh them without losing local edits. */
export type Metadata = typeof Metadata.Type
export const Metadata = S.Struct({
  remotes: S.Record(S.String, Remote).annotateKey({
    description: "Remote references as deduplicated keys; local sources are never recorded."
  })
})

export const read = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const { directory } = yield* WorkspaceRoot
  const file = `${directory}/traits/_metadata.json`
  if (!(yield* fs.exists(file))) {
    return Metadata.make({ remotes: {} })
  }
  return yield* fs.readFileString(file).pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(Metadata))))
})

/** Replace only after the complete, schema-validated metadata has been written. */
export const write = Effect.fn("IngestionMetadata.write")(function* (metadata: Metadata) {
  const fs = yield* FileSystem.FileSystem
  const { directory } = yield* WorkspaceRoot
  const text = yield* pipe(metadata, S.encodeEffect(S.fromJsonString(Metadata)), Effect.orDie)
  const file = `${directory}/traits/_metadata.json`
  const random = yield* SecureRandom.SecureRandom
  const id = yield* random.uuidV4()
  const temporary = `${file}.${id}.tmp`
  yield* fs.makeDirectory(`${directory}/traits`, { recursive: true })
  yield* fs.writeFileString(temporary, text)
  yield* fs.rename(temporary, file).pipe(Effect.ensuring(fs.remove(temporary).pipe(Effect.ignore)))
})
