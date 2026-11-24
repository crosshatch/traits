import { Array, Effect, Layer, Option, pipe, Predicate, Record, Ref, Schema as S, String } from "effect"
import { AiError, DecisionModel } from "effect/ai"
import { Digest } from "effect/crypto"
import { KeyValueStore } from "effect/persistence"

import type { Trait } from "../Trait/Trait.ts"
import { TraitAssertion } from "../Trait/TraitAssertion.ts"
import { TraitBody } from "../Trait/TraitBody.ts"
import { TraitMatchPattern } from "../Trait/TraitMatch.ts"
import { TraitName } from "../Trait/TraitName.ts"
import type { TraitPrelude } from "../Trait/TraitPrelude.ts"
import { TraitPurpose } from "../Trait/TraitPurpose.ts"
import { TraitSubject } from "../Trait/TraitSubject.ts"
import { type TraitCollection, TraitNotFoundError } from "../TraitCollection/TraitCollection.ts"
import { TraitCollectionNotFoundError, TraitCollections } from "../TraitCollection/TraitCollections.ts"
import { WorkspaceTraitCollection } from "../TraitCollection/WorkspaceTraitCollection.ts"
import * as DecisionCache from "../TraitRun/DecisionCache.ts"
import * as TraitRun from "../TraitRun/TraitRun.ts"
import { TraitSelectionId, TraitSelectionNotFoundError, TraitSelections } from "../TraitSelection/TraitSelections.ts"
import { Probability } from "../util/Probability.ts"

const matchOf = (match: string | Array.NonEmptyReadonlyArray<string>) =>
  typeof match === "string"
    ? TraitMatchPattern.make(match)
    : Array.map(match, (pattern) => TraitMatchPattern.make(pattern))

/** A trait with this name and these fields, and a purpose, which every trait must have. */
export const trait = (fields: {
  readonly name: string
  readonly subject?: string
  readonly match?: string | Array.NonEmptyReadonlyArray<string>
  readonly assertion?: string
  readonly body?: string
  readonly prelude?: TraitPrelude
}): Trait => ({
  name: TraitName.make(fields.name),
  purpose: TraitPurpose.make("Why it matters."),
  ...(fields.subject === undefined ? {} : { subject: TraitSubject.make(fields.subject) }),
  ...(fields.match === undefined ? {} : { match: matchOf(fields.match) }),
  ...(fields.assertion === undefined ? {} : { assertion: TraitAssertion.make(fields.assertion) }),
  ...(fields.body === undefined ? {} : { body: TraitBody.make(fields.body) }),
  ...(fields.prelude === undefined ? {} : { prelude: fields.prelude })
})

/** A collection holding these traits. */
const collection = (traits: ReadonlyArray<Trait>): TraitCollection => ({
  names: Effect.succeed(Array.map(traits, ({ name }) => name)),
  get: (name) =>
    pipe(
      Array.findFirst(traits, (candidate) => candidate.name === name),
      Effect.fromOption,
      Effect.mapError(() => TraitNotFoundError.make({ traitName: name }))
    )
})

const unused = Effect.die("not used by a run")

/** What one question asks, and the file text it asks about. */
export interface Question {
  readonly subject?: string
  readonly assertion?: string
  readonly context?: string
  readonly target: string
  /** What the trait's prelude found, as JSON, when the evidence carries it. */
  readonly prelude?: string
}

/** A workspace held in memory, with a decision model that answers each question by the given rule and records every request. A rule that returns nothing leaves the question unanswered. */
export const workspace = Effect.fn("workspace")(function* (options: {
  readonly files: Readonly<Record<string, string | undefined>>
  readonly own: ReadonlyArray<Trait>
  readonly sourced?: Readonly<Record<string, ReadonlyArray<Trait>>>
  /** The declared selections; one with the ID default holding every one of the workspace's own traits when omitted. */
  readonly selections?: Readonly<Record<string, ReadonlyArray<string>>>
  readonly answer: (question: Question) => number | undefined
  /** The input tokens the model reports for each request; 10 when omitted. */
  readonly tokens?: number
  /** What the provider reports each request to have cost, in US dollars; no cost reported when omitted. */
  readonly cost?: number
  /** Whether a request asking these questions fails outright. */
  readonly fails?: (questions: ReadonlyArray<Question>) => boolean
}) {
  const requests = yield* Ref.make<ReadonlyArray<ReadonlyArray<Question>>>([])
  const model = yield* DecisionModel.make({
    supportsImages: false,
    decide: Effect.fnUntraced(function* (request) {
      // The file text sits under evidence when subjects are asked about, and under content when assertions are.
      const state = Predicate.isObject(request.state) ? request.state : {}
      const shown = Predicate.isObject(state["evidence"]) ? state["evidence"] : state["content"]
      const target = Predicate.isObject(shown) ? globalThis.String(shown["target"]) : ""
      const prelude =
        Predicate.isObject(shown) && shown["prelude"] !== undefined ? JSON.stringify(shown["prelude"]) : undefined
      const questions = Record.map(request.decisions, ({ instructions }): Question => {
        const fields = Predicate.isObject(instructions) ? instructions : {}
        return {
          ...(Predicate.isString(fields["subject"]) ? { subject: fields["subject"] } : {}),
          ...(Predicate.isString(fields["assertion"]) ? { assertion: fields["assertion"] } : {}),
          ...(Predicate.isString(fields["context"]) ? { context: fields["context"] } : {}),
          target,
          ...(prelude === undefined ? {} : { prelude })
        }
      })
      yield* Ref.update(requests, Array.append(Record.values(questions)))
      if (options.fails?.(Record.values(questions)) === true) {
        return yield* AiError.make({
          module: "Test",
          method: "decide",
          reason: AiError.UnknownError.make({ description: "The provider is down." })
        })
      }
      return {
        answers: Record.fromEntries(
          Array.flatMap(Record.toEntries(questions), ([key, question]) => {
            const probability = options.answer(question)
            return probability === undefined ? [] : [[key, { _tag: "Probability" as const, probability }] as const]
          })
        ),
        usage: { inputTokens: options.tokens ?? 10, outputTokens: 1 },
        ...(options.cost === undefined ? {} : { metadata: { test: { cost: options.cost } } })
      }
    })
  })
  const root = new URL("file:///workspace/")
  // One cache for the workspace, so a later run finds what an earlier one was told.
  const cache = yield* Effect.service(DecisionCache.DecisionCache).pipe(
    Effect.provide(DecisionCache.layerKeyValueStore.pipe(Layer.provide(KeyValueStore.layerMemory)))
  )
  const selections = Record.toEntries(
    options.selections ?? { default: Array.map(options.own, (own): string => own.name) }
  )
  const layer = Layer.mergeAll(
    Layer.succeed(DecisionModel.DecisionModel, model),
    Layer.succeed(DecisionCache.DecisionCache, cache),
    Digest.layerWebCrypto,
    Layer.succeed(WorkspaceTraitCollection, {
      ...collection(options.own),
      write: () => unused,
      update: () => unused,
      rename: () => unused,
      delete: () => unused
    }),
    Layer.succeed(TraitCollections, {
      sources: unused,
      get: (id) =>
        pipe(
          Record.get(options.sourced ?? {}, id),
          Option.map(collection),
          Effect.fromOption,
          Effect.mapError(() => TraitCollectionNotFoundError.make({ traitSourceId: id }))
        ),
      update: () => unused,
      updateAll: unused
    }),
    Layer.effect(
      TraitSelections,
      Effect.gen(function* () {
        const declared = yield* Effect.forEach(
          selections,
          ([id, traits]) =>
            S.decodeEffect(TraitRun.Report.fields.traits)(traits).pipe(
              Effect.map((references) => ({ id: TraitSelectionId.make(id), traits: references }))
            ),
          { concurrency: 1 }
        )
        return TraitSelections.of({
          all: Effect.succeed(declared),
          get: (id) =>
            pipe(
              Array.findFirst(declared, (selection) => selection.id === id),
              Effect.fromOption,
              Effect.mapError(() => TraitSelectionNotFoundError.make({ traitSelectionId: id }))
            )
        })
      }).pipe(Effect.orDie)
    )
  )
  // Listed and read when asked, so a test that changes its files between runs is seen to.
  const project: TraitRun.Files = {
    root,
    paths: Effect.sync(() => Record.keys(options.files)),
    read: (path) =>
      Effect.sync(() =>
        pipe(
          Option.fromNullishOr(options.files[path]),
          Option.map((text) => ({ uri: new URL(path, root), text }))
        )
      )
  }
  return { layer, project, requests: Ref.get(requests) }
})

export const braces = trait({
  name: "always-brace",
  subject: "TypeScript if statements.",
  assertion: "Every if body has braces.",
  body: "A single-line body still needs braces."
})
export const readme = trait({ name: "concise-readme", subject: "README files.", assertion: "The README is short." })

/** Applies a trait when its subject and the file agree on TypeScript or README, and finds an assertion violated when the file says so. */
export const answer = ({ assertion, subject, target }: Question) =>
  subject !== undefined
    ? pipe(target, String.includes(pipe(subject, String.startsWith("TypeScript")) ? "if (" : "# "))
      ? 0.9
      : 0.1
    : assertion !== undefined && pipe(target, String.includes("BAD"))
      ? 0.2
      : 0.8

export const half = Probability.make(0.5)

export const name = (text: string) => ({ name: TraitName.make(text) })
