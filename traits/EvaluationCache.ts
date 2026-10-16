import { Array, Crypto, Effect, FileSystem, pipe, Schema as S } from "effect"
import { Hex } from "effect/encoding"

import { Assessment } from "./Assessment.ts"
import type { Source } from "./Source.ts"
import type { Trait } from "./Trait.ts"
import { TraitEvaluation } from "./TraitEvaluation.ts"

interface CacheInput {
  readonly directory: string
  readonly source: Source
  readonly context?: string | undefined
}

// Includes the frontmatter-aware, batched evaluator introduced on main.
const revision = 2

const lookup = Effect.fnUntraced(function* (options: CacheInput, trait: Trait) {
  const fs = yield* FileSystem.FileSystem
  const crypto = yield* Crypto.Crypto
  const key = yield* crypto
    .digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify({ revision, context: options.context, trait, source: options.source }))
    )
    .pipe(Effect.map(Hex.encode))
  const file = `${options.directory}/${key}.json`
  const previous = yield* fs.readFileString(file).pipe(
    Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(Assessment))),
    Effect.catchReasons("PlatformError", { NotFound: () => Effect.undefined }),
    Effect.catch((error) =>
      Effect.logWarning("Unable to read assessment cache; reassessing", error).pipe(Effect.andThen(Effect.undefined))
    )
  )
  return { file, trait, assessment: previous?.classification === "inconclusive" ? undefined : previous }
})

const persist = Effect.fnUntraced(function* (directory: string, file: string, assessment: Assessment) {
  const fs = yield* FileSystem.FileSystem
  const crypto = yield* Crypto.Crypto
  // Uncertainty and failed model calls must remain retryable, not count as coverage.
  if (assessment.classification !== "inconclusive") {
    const serialized = yield* pipe(assessment, S.encodeEffect(S.fromJsonString(Assessment)), Effect.orDie)
    yield* Effect.gen(function* () {
      yield* fs.makeDirectory(directory, { recursive: true })
      const id = yield* crypto.randomUUIDv4
      const temporary = `${file}.${id}.tmp`
      yield* fs.writeFileString(temporary, serialized)
      yield* fs.rename(temporary, file)
    }).pipe(Effect.catch((error) => Effect.logWarning("Unable to persist assessment cache", error)))
  }
})

export const cached = Effect.fnUntraced(function* <E, R>(
  options: CacheInput & {
    readonly trait: Trait
    readonly evaluate: Effect.Effect<TraitEvaluation, E, R>
  }
) {
  const entry = yield* lookup(options, options.trait)
  if (entry.assessment !== undefined)
    return TraitEvaluation.make({ trait: options.trait, source: options.source, assessment: entry.assessment })
  const result = yield* options.evaluate
  yield* persist(options.directory, entry.file, result.assessment)
  return result
})

/** Batch only missing traits, retaining main's request-size/concurrency limits. */
export const cachedAll = Effect.fnUntraced(function* <E, R>(
  options: CacheInput & {
    readonly traits: ReadonlyArray<Trait>
    readonly evaluate: (traits: ReadonlyArray<Trait>) => Effect.Effect<ReadonlyArray<TraitEvaluation>, E, R>
  }
) {
  const entries = yield* Effect.forEach(options.traits, (trait) => lookup(options, trait), { concurrency: "unbounded" })
  const missing = pipe(
    entries,
    Array.filter((entry) => entry.assessment === undefined),
    Array.map((entry) => entry.trait)
  )
  const fresh = missing.length === 0 ? [] : yield* options.evaluate(missing)
  yield* Effect.forEach(
    fresh,
    Effect.fnUntraced(function* (result) {
      const entry = yield* pipe(
        entries,
        Array.findFirst((entry) => entry.trait.id === result.trait.id),
        Effect.fromOption,
        Effect.orDie
      )
      yield* persist(options.directory, entry.file, result.assessment)
    }),
    { concurrency: "unbounded" }
  )
  return Array.appendAll(
    Array.flatMap(entries, (entry) =>
      entry.assessment === undefined
        ? []
        : [TraitEvaluation.make({ trait: entry.trait, source: options.source, assessment: entry.assessment })]
    ),
    fresh
  )
})
