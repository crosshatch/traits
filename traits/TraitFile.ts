import { Array, Effect, FileSystem, Path, pipe, Schema as S, String } from "effect"
import * as Yaml from "yaml"

import * as ExtensionModule from "./ExtensionModule.ts"
import { Trait } from "./Trait.ts"
import { TraitAssertion } from "./TraitAssertion.ts"
import { TraitBody } from "./TraitBody.ts"
import { TraitName } from "./TraitName.ts"
import { TraitPurpose } from "./TraitPurpose.ts"
import { TraitSubject } from "./TraitSubject.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

const reference = S.NonEmptyString.annotate({
  description: "A path relative to the trait file, or an ESM package reference, resolved from the trait file."
})

/** The YAML frontmatter of a trait file; unknown keys are rejected so outdated files are reported rather than misread. */
export type TraitFrontmatter = typeof TraitFrontmatter.Type
export const TraitFrontmatter = S.Struct({
  name: TraitName,
  subject: TraitSubject.pipe(S.optionalKey),
  assertion: TraitAssertion.pipe(S.optionalKey),
  purpose: TraitPurpose,
  /** The segmenter module reference; omitted to check whole files. */
  segment: reference
    .annotateKey({ description: "The segmenter module reference; omitted to check whole files." })
    .pipe(S.optionalKey),
  /** Enrichment module references, in order. */
  enrichments: S.NonEmptyArray(reference)
    .annotateKey({ description: "Enrichment module references, in order." })
    .pipe(S.optionalKey)
}).annotate({
  description:
    "The YAML frontmatter of a trait file; unknown keys are rejected so outdated files are reported rather than misread."
})

/** A trait as written to its file: frontmatter with extension references as written, and an optional Markdown body of supporting context. */
export type TraitDocument = typeof TraitDocument.Type
export const TraitDocument = S.Struct({
  ...TraitFrontmatter.fields,
  /** Supporting context, such as examples; not hidden requirements. */
  body: TraitBody.annotateKey({ description: "Supporting context, such as examples; not hidden requirements." }).pipe(
    S.optionalKey
  )
}).annotate({
  description:
    "A trait as written to its file: frontmatter with extension references as written, and an optional Markdown body of supporting context."
})

/** Renders a trait file: YAML frontmatter in canonical key order, then the body. */
export const serialize = (document: TraitDocument): string => {
  const { body, ...frontmatter } = document
  const yaml = Yaml.stringify(
    {
      name: frontmatter.name,
      subject: frontmatter.subject,
      assertion: frontmatter.assertion,
      purpose: frontmatter.purpose,
      segment: frontmatter.segment,
      enrichments: frontmatter.enrichments
    },
    { lineWidth: 80 }
  )
  return body === undefined ? `---\n${yaml}---\n` : `---\n${yaml}---\n\n${body}\n`
}

/** A trait file could not be read. */
export class TraitFileReadError extends S.TaggedError<TraitFileReadError>()("TraitFileReadError", {
  /** The trait file path. */
  path: S.String.annotateKey({ description: "The trait file path." }),
  /** The underlying filesystem failure. */
  cause: S.Defect().annotateKey({ description: "The underlying filesystem failure." })
}) {
  override get message(): string {
    return `Could not read trait file ${this.path}. Every checked trait needs a .agents/traits/<name>.md file.`
  }
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

/** A trait file's text: YAML frontmatter between --- lines, then an optional Markdown body. */
const TraitText = S.Union([
  S.TemplateLiteralParser([Delimiter, FrontmatterLines, Delimiter, S.String]),
  S.TemplateLiteralParser([Delimiter, FrontmatterLines, "---", ""])
])

/** Parses a trait file into its frontmatter and trimmed body; extension references are not resolved yet. */
export const parse = Effect.fn("TraitFile.parse")(function* (input: { readonly path: string; readonly text: string }) {
  const [, frontmatterText, , bodyText] = yield* pipe(
    input.text,
    S.decodeUnknownEffect(TraitText),
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
  const body = pipe(bodyText, String.trim)
  return { frontmatter, body: body === "" ? undefined : TraitBody.make(body) }
})

/** Parses a trait file's text and resolves its extension references relative to the file, which must be named for the trait. */
export const decode = Effect.fn("TraitFile.decode")(function* (name: TraitName, file: string, text: string) {
  const path = yield* Path.Path
  const { frontmatter, body } = yield* parse({ path: file, text })
  if (frontmatter.name !== name) {
    return yield* TraitFileParseError.make({
      path: file,
      problem: `its name is "${frontmatter.name}", but the file is named for "${name}".`
    })
  }
  // The file path is absolute, so it always converts to a URL.
  const baseUrl = yield* path.toFileUrl(file).pipe(Effect.orDie)
  const resolve = (reference: string) => ExtensionModule.resolve({ reference, baseUrl })
  const segment = frontmatter.segment === undefined ? undefined : yield* resolve(frontmatter.segment)
  const enrichments =
    frontmatter.enrichments === undefined
      ? undefined
      : // A trait lists few enrichments, and resolving one only locates a module file, so resolve them together.
        yield* Effect.all(Array.map(frontmatter.enrichments, resolve), { concurrency: "unbounded" })
  return Trait.make({
    name: frontmatter.name,
    purpose: frontmatter.purpose,
    ...(frontmatter.subject === undefined ? {} : { subject: frontmatter.subject }),
    ...(frontmatter.assertion === undefined ? {} : { assertion: frontmatter.assertion }),
    ...(segment === undefined ? {} : { segment }),
    ...(enrichments === undefined ? {} : { enrichments }),
    ...(body === undefined ? {} : { body })
  })
})

/** Loads .agents/traits/<name>.md and resolves its extension references relative to the file. */
export const load = Effect.fn("TraitFile.load")(function* (name: TraitName) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const file = path.join(directory, WorkspaceLayout.traitFile(name))
  const text = yield* fs
    .readFileString(file)
    .pipe(Effect.mapError((cause) => TraitFileReadError.make({ path: file, cause })))
  return yield* decode(name, file, text)
})
