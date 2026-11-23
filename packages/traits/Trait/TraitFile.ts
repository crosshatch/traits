import { Array, Effect, pipe, Predicate, Record, Schema as S, String, Struct } from "effect"
import * as Yaml from "yaml"

import { Trait } from "./Trait.ts"

/** Text is not a trait file: Markdown with valid trait frontmatter. */
export class TraitFileParseError extends S.TaggedError<TraitFileParseError>()("TraitFileParseError", {
  /** What is wrong with the text. */
  problem: S.String.annotateKey({ description: "What is wrong with the text." })
}) {
  override get message() {
    return `Not a valid trait file: ${this.problem} Trait files are Markdown with YAML frontmatter containing name, purpose, and optional subject, match, assertion, and prelude; the body is supporting context.`
  }
}

/** The YAML frontmatter of a trait file; unknown keys are rejected so outdated files are reported rather than misread. */
const TraitFrontmatter = Trait.mapFields(Struct.omit(["body"]))

const Delimiter = S.Literals(["---\r\n", "---\n"])
/** Frontmatter lines up to the first closing delimiter, so a later --- in the Markdown body stays in the body. */
const FrontmatterLines = S.String.check(S.isPattern(/^(?:(?!---(?:\r?\n|$))[^\n]*\n)*$/u))

// Far deeper than a prelude a person would write, and far shallower than what exhausts the stack.
const maxNesting = 64

/** Whether a value nests lists and maps more than this many levels deep, found without recursing into it. */
const nestsDeeperThan = (value: unknown, levels: number): boolean => {
  let level: ReadonlyArray<unknown> = [value]
  for (let depth = 0; depth <= levels; depth++) {
    level = Array.flatMap(level, (item) =>
      Array.isArray(item) ? item : Predicate.isObject(item) ? Record.values(item) : []
    )
    if (!Array.isReadonlyArrayNonEmpty(level)) {
      return false
    }
  }
  return true
}

/** Parses the text of a trait file into its trait, with a trimmed body. */
export const parse = Effect.fn("TraitFile.parse")(function* (text: string) {
  const [, frontmatterText, , bodyText] = yield* pipe(
    text,
    // YAML frontmatter between --- lines, then an optional Markdown body.
    S.decodeUnknownEffect(
      S.Union([
        S.TemplateLiteralParser([Delimiter, FrontmatterLines, Delimiter, S.String]),
        S.TemplateLiteralParser([Delimiter, FrontmatterLines, "---", ""])
      ])
    ),
    Effect.mapError(() =>
      TraitFileParseError.make({ problem: "it must start with YAML frontmatter between --- lines." })
    )
  )
  const yaml = yield* Effect.try({
    try: (): unknown => Yaml.parse(frontmatterText),
    catch: (cause) =>
      TraitFileParseError.make({ problem: `its frontmatter is not valid YAML (${globalThis.String(cause)}).` })
  })
  // Validating a value recurses into it, and a trait file from a source is not trusted, so nesting deep enough to exhaust the stack is turned away first.
  if (nestsDeeperThan(yaml, maxNesting)) {
    return yield* TraitFileParseError.make({
      problem: `its frontmatter is nested more than ${maxNesting} levels deep.`
    })
  }
  const frontmatter = yield* pipe(
    yaml,
    S.decodeUnknownEffect(TraitFrontmatter, { onExcessProperty: "error" }),
    Effect.mapError((cause) =>
      TraitFileParseError.make({ problem: `its frontmatter does not match the trait schema: ${cause.message}.` })
    )
  )
  const body = String.trim(bodyText)
  if (body === "") {
    return Trait.make(frontmatter)
  }
  return yield* pipe(
    { ...frontmatter, body },
    S.decodeEffect(Trait),
    Effect.mapError((cause) => TraitFileParseError.make({ problem: `its body is not valid: ${cause.message}.` }))
  )
})

/** Renders a trait as the text of a trait file: YAML frontmatter in the trait's own key order, then the body. */
export const serialize = (trait: Trait): string => {
  const { body, ...frontmatter } = trait
  const yaml = Yaml.stringify(
    Record.fromEntries(Array.map(Record.keys(TraitFrontmatter.fields), (key) => [key, frontmatter[key]])),
    { lineWidth: 80 }
  )
  return body === undefined ? `---\n${yaml}---\n` : `---\n${yaml}---\n\n${body}\n`
}
