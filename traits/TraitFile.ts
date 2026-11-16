import { Array, Effect, pipe, Record, Schema as S, String, Struct } from "effect"
import * as Yaml from "yaml"

import { Trait } from "./Trait.ts"
import { TraitBody } from "./TraitBody.ts"

/** A path relative to the trait file, or an ESM package reference, resolved from the trait file. */
const reference = S.NonEmptyString.annotate({
  description: "A path relative to the trait file, or an ESM package reference, resolved from the trait file."
})

/** A trait as written to its file: the trait with its extension references as written rather than resolved, and an optional Markdown body of supporting context. */
export type TraitDocument = typeof TraitDocument.Type
export const TraitDocument = Trait.mapFields(
  Struct.assign({
    /** The segmenter module reference; omitted to check whole files. */
    segment: reference
      .annotateKey({ description: "The segmenter module reference; omitted to check whole files." })
      .pipe(S.optionalKey),
    /** Ordered, distinct enrichment module references, at most 32; omitted when none are configured. */
    enrichments: S.NonEmptyArray(reference)
      .check(S.isMaxLength(32), S.isUnique())
      .annotate({
        description: "Ordered, distinct enrichment module references, at most 32; omitted when none are configured."
      })
      .pipe(S.optionalKey)
  })
).annotate({
  description:
    "A trait as written to its file: the trait with its extension references as written rather than resolved, and an optional Markdown body of supporting context."
})

/** The YAML frontmatter of a trait file, in canonical key order; unknown keys are rejected so outdated files are reported rather than misread. */
const TraitFrontmatter = TraitDocument.mapFields(Struct.omit(["body"]))

/** Renders a trait file: YAML frontmatter in canonical key order, then the body. */
export const serialize = (document: TraitDocument): string => {
  const { body, ...frontmatter } = document
  const yaml = Yaml.stringify(
    Record.fromEntries(Array.map(Record.keys(TraitFrontmatter.fields), (key) => [key, frontmatter[key]])),
    { lineWidth: 80 }
  )
  return body === undefined ? `---\n${yaml}---\n` : `---\n${yaml}---\n\n${body}\n`
}

/** A trait file is not Markdown with valid trait frontmatter. */
export class TraitFileParseError extends S.TaggedError<TraitFileParseError>()("TraitFileParseError", {
  /** The trait file path. */
  path: S.String.annotateKey({ description: "The trait file path." }),
  /** What is wrong with the file. */
  problem: S.String.annotateKey({ description: "What is wrong with the file." })
}) {
  override get message(): string {
    return `${this.path} is not a valid trait file: ${this.problem}\nTrait files are Markdown with YAML frontmatter containing name, purpose, and optional subject, assertion, segment, and enrichments; the body is supporting context. If it was written for an earlier traits version, run \`traits update\` and follow its migration steps.`
  }
}

const Delimiter = S.Literals(["---\r\n", "---\n"])
/** Frontmatter lines up to the first closing delimiter, so a later --- in the Markdown body stays in the body. */
const FrontmatterLines = S.String.check(S.isPattern(/^(?:(?!---(?:\r?\n|$))[^\n]*\n)*$/u))

/** Parses a trait file into its document with a trimmed body; extension references are not resolved yet. */
export const parse = Effect.fn("TraitFile.parse")(function* (input: { readonly path: string; readonly text: string }) {
  const [, frontmatterText, , bodyText] = yield* pipe(
    input.text,
    // YAML frontmatter between --- lines, then an optional Markdown body.
    S.decodeUnknownEffect(
      S.Union([
        S.TemplateLiteralParser([Delimiter, FrontmatterLines, Delimiter, S.String]),
        S.TemplateLiteralParser([Delimiter, FrontmatterLines, "---", ""])
      ])
    ),
    Effect.mapError(() =>
      TraitFileParseError.make({ path: input.path, problem: "it must start with YAML frontmatter between --- lines." })
    )
  )
  const yaml = yield* Effect.try({
    try: (): unknown => Yaml.parse(frontmatterText),
    catch: (cause) =>
      TraitFileParseError.make({
        path: input.path,
        problem: `its frontmatter is not valid YAML (${globalThis.String(cause)}).`
      })
  })
  const frontmatter = yield* pipe(
    yaml,
    S.decodeUnknownEffect(TraitFrontmatter, { onExcessProperty: "error" }),
    Effect.mapError((cause) =>
      TraitFileParseError.make({
        path: input.path,
        problem: `its frontmatter does not match the current schema: ${cause.message}`
      })
    )
  )
  const text = pipe(bodyText, String.trim)
  if (text === "") {
    return TraitDocument.make(frontmatter)
  }
  const body = yield* pipe(
    text,
    S.decodeEffect(TraitBody),
    Effect.mapError((cause) =>
      TraitFileParseError.make({ path: input.path, problem: `its body is not valid: ${cause.message}` })
    )
  )
  return TraitDocument.make({ ...frontmatter, body })
})
