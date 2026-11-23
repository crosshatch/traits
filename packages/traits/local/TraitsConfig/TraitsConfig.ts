import { Array, Effect, Record, Schema as S } from "effect"

import { TraitSource } from "../../TraitCollection/TraitSource.ts"
import { TraitSourceId } from "../../TraitCollection/TraitSourceId.ts"
import { TraitSelection } from "../../TraitSelection/TraitSelection.ts"
import { TraitSelectionId } from "../../TraitSelection/TraitSelectionId.ts"
import * as LocalJsonFile from "../LocalJsonFile.ts"
import { LocalPaths } from "../LocalPaths.ts"
import { SegmentationRule } from "../Segmentation/SegmentationRule.ts"
import { ModelConfiguration } from "./ModelConfiguration.ts"

/** The workspace configuration in traits/config.json: plain JSON, so it loads without executing code or installing JavaScript dependencies. Every traits/<name>.md file is one of the workspace's own traits, each traits/<id>/ directory holds the traits of a declared source, and selections choose which of them to run. Unknown keys are rejected so outdated files are reported rather than misread. */
export type TraitsConfig = typeof TraitsConfig.Type
export const TraitsConfig = S.Struct({
  /** The traits version this workspace's configuration and trait files were last written for. It never stops them from loading; an agent compares it with the installed version to tell when to warn that an update is available. */
  version: S.SemVerFromString.annotateKey({
    description:
      "The traits version this workspace's configuration and trait files were last written for. It never stops them from loading; an agent compares it with the installed version to tell when to warn that an update is available."
  }),
  models: ModelConfiguration,
  /** The sources that collections of traits come from, by the ID that selections refer to each with; none when omitted. Each collection's traits are kept in traits/<id>/. */
  sources: S.Record(TraitSourceId, TraitSource)
    .annotateKey({
      description:
        "The sources that collections of traits come from, by the ID that selections refer to each with; none when omitted. Each collection's traits are kept in traits/<id>/."
    })
    .pipe(S.withDecodingDefaultKey(Effect.succeed({}))),
  /** Selections of traits to run, by the ID each is chosen with, such as ci; none when omitted. The one with the ID default is what runs when no selection is named. A trait is referred to by the path of its file under traits/ without the extension, such as my-trait or effect/my-trait. */
  selections: S.Record(TraitSelectionId, TraitSelection.fields.traits)
    .annotateKey({
      description:
        "Selections of traits to run, by the ID each is chosen with, such as ci; none when omitted. The one with the ID default is what runs when no selection is named. A trait is referred to by the path of its file under traits/ without the extension, such as my-trait or effect/my-trait."
    })
    .pipe(S.withDecodingDefaultKey(Effect.succeed({}))),
  /** How files are divided into the segments that are checked on their own, as rules tried in order, the first whose pattern matches a file deciding; none when omitted. Files no rule matches are divided by the built-in rules: JavaScript and TypeScript files by typescript, and every other file kept whole. */
  segmentation: S.Array(SegmentationRule)
    .annotateKey({
      description:
        "How files are divided into the segments that are checked on their own, as rules tried in order, the first whose pattern matches a file deciding; none when omitted. Files no rule matches are divided by the built-in rules: JavaScript and TypeScript files by typescript, and every other file kept whole."
    })
    .pipe(S.withDecodingDefaultKey(Effect.succeed([]))),
  /** Glob patterns, relative to the workspace root, for project files to skip, such as lockfiles or large generated assets; none when omitted. They are written as a trait's match patterns are: * matches within one name, ** across directories, and {a,b} either alternative. */
  exclude: S.Array(S.NonEmptyString)
    .annotateKey({
      description:
        "Glob patterns, relative to the workspace root, for project files to skip, such as lockfiles or large generated assets; none when omitted. They are written as a trait's match patterns are: * matches within one name, ** across directories, and {a,b} either alternative."
    })
    .pipe(S.withDecodingDefaultKey(Effect.succeed([])))
})
  .annotate({
    description:
      "The workspace configuration in traits/config.json: plain JSON, so it loads without executing code or installing JavaScript dependencies. Every traits/<name>.md file is one of the workspace's own traits, each traits/<id>/ directory holds the traits of a declared source, and selections choose which of them to run. Unknown keys are rejected so outdated files are reported rather than misread."
  })
  .check(
    // A reference to a source that is not declared could never be resolved, so it is reported when the file is read.
    S.makeFilter((config) =>
      Array.flatMap(Record.toEntries(config.selections), ([id, traits]) =>
        Array.flatMap(traits, ({ source }, index) =>
          source === undefined || Record.has(config.sources, source)
            ? []
            : [{ path: ["selections", id, index], issue: `No source with the ID ${source} is declared under sources.` }]
        )
      )
    )
  )

/** Loads and validates traits/config.json. The version it names never stops it from loading. */
export const load = Effect.gen(function* () {
  const paths = yield* LocalPaths
  return yield* LocalJsonFile.read(paths.config, TraitsConfig)
}).pipe(Effect.withSpan("TraitsConfig.load"))
