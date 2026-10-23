import { Array, Crypto, Effect, HashSet, Order, pipe, Schema as S, String } from "effect"
import { Hex } from "effect/encoding"

import { Assessment } from "./Assessment.ts"
import * as Trait from "./Trait.ts"

export type Finding = typeof Finding.Type
export const Finding = S.Struct({
  traitName: Trait.TraitName,
  assessment: Assessment
})

export type Chunk = typeof Chunk.Type
export const Chunk = S.Struct({
  startLine: S.Int.check(S.isGreaterThan(0)),
  text: S.String,
  findings: S.NonEmptyArray(Finding)
})

export type File = typeof File.Type
export const File = S.Struct({
  path: S.String,
  revision: S.String.check(S.isPattern(/^sha256:[0-9a-f]{64}$/)),
  chunks: S.NonEmptyArray(Chunk)
})

export type CheckReport = typeof CheckReport.Type
export const CheckReport = S.Struct({
  traits: S.Array(Trait.Trait),
  files: S.Array(File)
})

/** Identifies the complete file snapshot read for evaluation, including line endings. */
export const revision = Effect.fnUntraced(function* (text: string) {
  const crypto = yield* Crypto.Crypto
  return yield* crypto
    .digest("SHA-256", new TextEncoder().encode(text))
    .pipe(Effect.map((bytes) => `sha256:${Hex.encode(bytes)}`))
})

export const compact = (report: CheckReport): CheckReport => {
  const names = pipe(
    report.files,
    Array.flatMap((file) => file.chunks),
    Array.flatMap((chunk) => chunk.findings),
    Array.map((finding) => finding.traitName),
    HashSet.fromIterable
  )
  return CheckReport.make({
    traits: pipe(
      report.traits,
      Array.filter((trait) => HashSet.has(names, trait.name)),
      Array.sortBy(Order.mapInput(String.Order, (trait: Trait.Trait) => trait.name))
    ),
    files: pipe(report.files, Array.sortBy(Order.mapInput(String.Order, (file: File) => file.path)))
  })
}
