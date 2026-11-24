import { Array, Effect, FileSystem, Order, Path, pipe, Schema as S, String } from "effect"
import { Digest } from "effect/crypto"

import * as TraitFile from "../Trait/TraitFile.ts"
import { TraitName } from "../Trait/TraitName.ts"

/** A trait file in a directory: the trait name its file name gives, and its text. */
export interface LocalTraitFile {
  readonly name: TraitName
  readonly text: string
}

const extension = ".md"

/** The name of the file that holds the trait with this name. */
export const fileName = (name: TraitName): string => `${name}${extension}`

/** The names of a directory's trait files: its top-level <name>.md files whose name is a valid trait name. */
export const names = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem
  const entries = yield* fs.readDirectory(directory)
  return pipe(
    entries,
    Array.filter(String.endsWith(extension)),
    Array.map(String.slice(0, -extension.length)),
    Array.filter(S.is(TraitName)),
    Array.sort(Order.String)
  )
})

/** Lists a directory's trait files, each with its text, in order of name. */
export const ls = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const found = yield* names(directory)
  return yield* Effect.forEach(
    found,
    Effect.fnUntraced(function* (name) {
      const text = yield* fs.readFileString(path.join(directory, fileName(name)))
      return { name, text } satisfies LocalTraitFile
    }),
    { concurrency: 1 }
  )
})

/** Parses a trait file, whose trait must have the name of its file. */
export const parse = Effect.fnUntraced(function* ({ name, text }: LocalTraitFile) {
  const trait = yield* TraitFile.parse(text)
  if (trait.name !== name) {
    return yield* TraitFile.TraitFileParseError.make({
      problem: `its name ${trait.name} does not match its file name ${fileName(name)}.`
    })
  }
  return trait
})

/** A trait file's text with LF line endings. Git may check a committed file out with CRLF line endings, which must not count as a change to it. */
export const normalizedText = ({ text }: LocalTraitFile): string => pipe(text, String.replaceAll("\r\n", "\n"))

/** A hash of trait files by name and text, whatever their line endings. */
export const hash = Effect.fnUntraced(function* (files: ReadonlyArray<LocalTraitFile>) {
  const digest = yield* Digest.Digest
  const lines = yield* Effect.forEach(
    files,
    (file) =>
      digest
        .digestHex(Digest.sha256, new TextEncoder().encode(normalizedText(file)))
        .pipe(Effect.map((hash) => `${hash}  ${fileName(file.name)}\n`)),
    { concurrency: 1 }
  )
  return yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(Array.join(lines, "")))
})
