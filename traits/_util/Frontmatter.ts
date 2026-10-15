import { Effect, pipe, Schema as S } from "effect"
import * as Yaml from "yaml"

export class MissingFrontmatterError extends S.TaggedError<MissingFrontmatterError>()("MissingFrontmatterError", {
  path: S.String,
  message: S.String
}) {}

export class UnterminatedFrontmatterError extends S.TaggedError<UnterminatedFrontmatterError>()(
  "UnterminatedFrontmatterError",
  {
    path: S.String,
    message: S.String
  }
) {}

export class InvalidYamlError extends S.TaggedError<InvalidYamlError>()("InvalidYamlError", {
  path: S.String,
  message: S.String,
  line: S.Int.pipe(S.optional),
  column: S.Int.pipe(S.optional),
  cause: S.Defect()
}) {}

export type ParseError = typeof ParseError.Type
export const ParseError = S.Union([MissingFrontmatterError, UnterminatedFrontmatterError, InvalidYamlError])

const OpeningDelimiter = S.Literals(["---\r\n", "---\n"])
const FrontmatterLines = S.String.check(S.isPattern(/^(?:(?!---(?:\r?\n|$))[^\n]*\n)*$/))
const DocumentParts = S.String.pipe(
  S.decodeTo(
    S.Union([
      S.TemplateLiteralParser([OpeningDelimiter, FrontmatterLines, "---\r\n", S.String]),
      S.TemplateLiteralParser([OpeningDelimiter, FrontmatterLines, "---\n", S.String]),
      S.TemplateLiteralParser([OpeningDelimiter, FrontmatterLines, "---", ""])
    ])
  )
)

export const parse = <Schema extends S.Top>(schema: Schema) =>
  Effect.fn("Frontmatter.parse")(function* (input: { readonly text: string; readonly path: string }) {
    const [, yaml, , body] = yield* pipe(
      input.text,
      S.decodeEffect(DocumentParts),
      Effect.mapError(() =>
        pipe(input.text, S.is(S.Union([S.Literal("---"), S.TemplateLiteral([OpeningDelimiter, S.String])])))
          ? UnterminatedFrontmatterError.make({
              path: input.path,
              message: "Frontmatter is missing its closing delimiter"
            })
          : MissingFrontmatterError.make({ path: input.path, message: "Document must start with YAML frontmatter" })
      )
    )
    const parsed = yield* Effect.try({
      try: () => Yaml.parse(yaml),
      catch: (cause) => {
        const position = cause instanceof Yaml.YAMLParseError ? cause.linePos?.[0] : undefined
        return InvalidYamlError.make({
          path: input.path,
          message: "Invalid YAML frontmatter",
          ...(position === undefined ? {} : { line: position.line + 1, column: position.col }),
          cause
        })
      }
    })
    const frontmatter = yield* pipe(parsed, S.decodeUnknownEffect(schema))
    return { frontmatter, body }
  })

export const serialize = (document: { readonly frontmatter: unknown; readonly body: string }): string =>
  `---\n${Yaml.stringify(document.frontmatter)}---\n${document.body}`
