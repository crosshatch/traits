import { getRawAsset, isSea } from "node:sea"

import { Array, Effect, FileSystem, Option, Path, pipe, Schema as S, String } from "effect"
import { UserDirectories } from "effect/persistence"

import type { InputRange } from "../../../Input/InputRange.ts"
import PackageJson from "../../../package.json" with { type: "json" }
import * as Platform from "../../../util/platform.ts"

/** The parser could not be loaded, such as on a platform it has no native library for. */
export class ParserUnavailableError extends S.TaggedError<ParserUnavailableError>()("ParserUnavailableError", {
  /** The underlying failure. */
  cause: S.Defect().annotateKey({ description: "The underlying failure." })
}) {
  override get message() {
    return "The TypeScript parser could not be loaded."
  }
}

/** The name the parser's native library is embedded under in the standalone executable. */
export const embeddedParser = "oxc-parser.node"

/** What dividing a file needs from a parse of it. */
interface Parsed {
  /** The file's top-level statements, in order. */
  readonly statements: ReadonlyArray<{
    readonly type: string
    readonly start: number
    readonly end: number
    /** The module an import or a re-export names. */
    readonly source?: unknown
  }>
  readonly comments: ReadonlyArray<{ readonly start: number; readonly end: number }>
  readonly errors: ReadonlyArray<{ readonly severity: string }>
}

/** Parses a file by its name and text, or gives nothing when the parser cannot make sense of what it is given. */
type Parse = (file: string, text: string) => Option.Option<Parsed>

/** The segments of a parsed file: each top-level statement with the comments that belong to it, and each run of imports and re-exports as one segment, so that a file's module links are read together rather than one line at a time. */
const segments = (text: string, parsed: Parsed): ReadonlyArray<InputRange> => {
  const statements = Array.map(parsed.statements, (statement) => ({
    start: statement.start,
    end: statement.end,
    // An import, or a re-export from another module, only links this module to another.
    link:
      statement.type === "ImportDeclaration" ||
      statement.type === "ExportAllDeclaration" ||
      (statement.type === "ExportNamedDeclaration" && statement.source !== null && statement.source !== undefined)
  }))
  const withComments = Array.map(statements, (statement, index) => {
    const previous = statements[index - 1]
    const next = statements[index + 1]
    // A comment on the line a statement ends on trails it. Any other comment before a statement leads it, such as its documentation.
    const leading = Array.filter(
      parsed.comments,
      (comment) =>
        comment.end <= statement.start &&
        comment.start >= (previous?.end ?? 0) &&
        (previous === undefined || pipe(text, String.slice(previous.end, comment.start), String.includes("\n")))
    )
    const trailing = Array.filter(
      parsed.comments,
      (comment) =>
        comment.start >= statement.end &&
        comment.end <= (next?.start ?? text.length) &&
        !pipe(text, String.slice(statement.end, comment.start), String.includes("\n"))
    )
    return {
      start: Math.min(statement.start, ...Array.map(leading, (comment) => comment.start)),
      end: Math.max(statement.end, ...Array.map(trailing, (comment) => comment.end)),
      link: statement.link
    }
  })
  return pipe(
    withComments,
    Array.chop((remaining) => {
      const [first, ...rest] = remaining
      const run = first.link ? Array.takeWhile(rest, (statement) => statement.link) : []
      const last = Array.last(run)
      return [
        { start: first.start, end: Option.isSome(last) ? last.value.end : first.end },
        Array.drop(rest, run.length)
      ]
    })
  )
}

/** The parser's native library gives the syntax tree as JSON text, with the tree under node. */
const NativeProgram = S.fromJsonString(
  S.Struct({
    node: S.Struct({
      body: S.Array(
        S.Struct({ type: S.String, start: S.Natural, end: S.Natural, source: S.Unknown.pipe(S.optionalKey) })
      )
    })
  })
)

/** What the parser's native library exports that dividing a file uses. */
interface NativeParser {
  readonly parseSync: (
    file: string,
    text: string
  ) => { readonly program: string; readonly comments: Parsed["comments"]; readonly errors: Parsed["errors"] }
}

/** Loads the parser from the native library that the standalone executable carries inside it. The executable cannot load a library from within itself, so the library is first written to the user's cache. */
const loadEmbedded = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const directories = yield* UserDirectories.UserDirectories
  // The user's own cache directory, which other users of the machine cannot write to, unlike a shared temporary directory.
  const cache = yield* directories.cache("traits")
  const file = path.join(cache, `oxc-parser-${PackageJson.version}-${Platform.target}.node`)
  const embedded = yield* Effect.try({
    try: () => new Uint8Array(getRawAsset(embeddedParser)),
    catch: (cause) => ParserUnavailableError.make({ cause })
  })
  const existing = yield* fs.readFile(file).pipe(Effect.option)
  // A file that is not exactly the embedded library is replaced, whether it was cut short or changed.
  const intact = Option.exists(
    existing,
    (bytes) => bytes.length === embedded.length && bytes.every((byte, index) => byte === embedded[index])
  )
  if (!intact) {
    yield* fs.makeDirectory(cache, { recursive: true })
    const staged = `${file}.${globalThis.crypto.randomUUID()}.tmp`
    yield* fs.writeFile(staged, embedded)
    // Moved into place whole, so another process starting at the same time never loads part of it.
    yield* fs.rename(staged, file)
  }
  const library = yield* Effect.try({
    try: () => {
      const module = { exports: {} }
      process.dlopen(module, file)
      return module.exports as NativeParser
    },
    catch: (cause) => ParserUnavailableError.make({ cause })
  })
  const parse: Parse = (name, text) =>
    pipe(
      Option.liftThrowable(() => library.parseSync(name, text))(),
      Option.flatMap((result) =>
        pipe(
          S.decodeOption(NativeProgram)(result.program),
          Option.map(({ node }) => ({ statements: node.body, comments: result.comments, errors: result.errors }))
        )
      )
    )
  return parse
}).pipe(Effect.catchTag("PlatformError", (cause) => ParserUnavailableError.make({ cause })))

/** Loads the parser as a package, which finds its own native library among the installed packages. */
const loadInstalled = Effect.gen(function* () {
  const { parseSync } = yield* Effect.tryPromise({
    try: () => import("oxc-parser"),
    catch: (cause) => ParserUnavailableError.make({ cause })
  })
  const parse: Parse = (name, text) =>
    pipe(
      Option.liftThrowable(() => parseSync(name, text))(),
      Option.map((result) => ({ statements: result.program.body, comments: result.comments, errors: result.errors }))
    )
  return parse
})

/** Loads the parser, and returns what divides a JavaScript or TypeScript file into segments: its text's ranges, or none when the file does not parse, as with a syntax error or another language. It fails when the parser itself cannot be loaded. */
export const load = Effect.gen(function* () {
  const parse = yield* isSea() ? loadEmbedded : loadInstalled
  yield* Effect.logDebug("Loaded the TypeScript parser.")
  return (file: string, text: string): Option.Option<ReadonlyArray<InputRange>> =>
    pipe(
      parse(file, text),
      Option.filter((parsed) => Array.every(parsed.errors, (error) => error.severity !== "Error")),
      Option.map((parsed) => segments(text, parsed)),
      Option.filter(Array.isReadonlyArrayNonEmpty)
    )
})
