import { expect, it } from "@effect/vitest"
import { Array, Effect, Layer, Record, Stream } from "effect"
import { Chat, DecisionModel, LanguageModel } from "effect/ai"
import { Digest } from "effect/crypto"

import { EnrichmentContext } from "../Enrichment/EnrichmentContext.ts"
import * as EnrichmentRegistry from "../Enrichment/EnrichmentRegistry.ts"
import {
  Check,
  EnrichmentRegistry as PublicEnrichmentRegistry,
  Report,
  SegmenterRegistry as PublicSegmenterRegistry,
  Trait,
  WorkspacePath as PathSchema
} from "../index.ts"
import { SegmenterSetupError } from "../Segmenter/Segmenter.ts"
import * as SegmenterRegistry from "../Segmenter/SegmenterRegistry.ts"
import * as TraitDerivation from "../TraitDerivation.ts"
import * as TraitFile from "../TraitFile.ts"
import { TraitName } from "../TraitName.ts"
import { TraitPurpose } from "../TraitPurpose.ts"
import { RecoveryInstruction } from "../util/RecoveryInstruction.ts"
import { WorkspacePath } from "../util/WorkspacePath.ts"

const proposal = TraitFile.TraitDocument.make({
  name: TraitName.make("proposed"),
  purpose: TraitPurpose.make("Keep code readable.")
})

const models = (label: string) =>
  Layer.mergeAll(
    Layer.effect(
      DecisionModel.DecisionModel,
      DecisionModel.make({
        decide: (options) =>
          Effect.succeed({
            answers: Record.map(options.decisions, () => ({
              _tag: "Classify" as const,
              label,
              probabilities: Record.fromEntries(
                Array.map(["distinct", "covered", "clarification", "conflict", "inconclusive"], (candidate) => [
                  candidate,
                  candidate === label ? 1 : 0
                ])
              )
            })),
            usage: { inputTokens: undefined, outputTokens: undefined }
          })
      })
    ),
    Layer.effect(
      LanguageModel.LanguageModel,
      LanguageModel.make({
        generateText: () =>
          Effect.succeed([
            { type: "text", text: JSON.stringify({ reasons: [{ name: "existing", reason: "Same rule." }] }) }
          ]),
        streamText: () => Stream.empty
      })
    )
  )

it.effect("checks in-memory traits and sources through the public API without Node services", () =>
  Check.check({
    traits: [
      {
        trait: Trait.Trait.make({ name: proposal.name, purpose: proposal.purpose }),
        origin: Report.TraitOrigin.cases.Programmatic.make({})
      }
    ],
    changes: [{ after: { path: PathSchema.make("file.ts"), text: "const value = 1" } }]
  }).pipe(
    Effect.provide([
      models("distinct"),
      PublicSegmenterRegistry.layer(() => Effect.die("No segmenter configured")),
      PublicEnrichmentRegistry.layer(() => Effect.die("No enrichment configured")),
      Digest.layerWebCrypto
    ]),
    Effect.map((report) => {
      expect(report.traits[0]?.origin).toEqual({ _tag: "Programmatic" })
      expect(report.diagnostics).toEqual([])
    })
  )
)

it.effect("prepares a new trait in memory without platform services or approval", () =>
  Effect.gen(function* () {
    const plan = yield* TraitDerivation.prepare(proposal, [])
    expect(plan).toEqual({
      _tag: "Proposed",
      document: proposal,
      text: TraitFile.serialize(proposal),
      current: undefined,
      relationship: undefined,
      reason: undefined
    })
  }).pipe(Effect.provide(models("distinct")))
)

it.effect("prepares an explained replacement with its exact current snapshot", () =>
  Effect.gen(function* () {
    const text = TraitFile.serialize({ ...proposal, name: TraitName.make("existing") })
    const plan = yield* TraitDerivation.prepare(proposal, [{ name: TraitName.make("existing"), text }])
    expect(plan).toMatchObject({
      _tag: "Proposed",
      document: { name: "existing" },
      current: text,
      relationship: "clarification",
      reason: "Same rule."
    })
  }).pipe(Effect.provide(models("clarification")))
)

it.effect("returns explained blocking outcomes without proposing a write", () =>
  Effect.gen(function* () {
    const plan = yield* TraitDerivation.prepare(proposal, [
      { name: TraitName.make("existing"), text: TraitFile.serialize(proposal) }
    ])
    expect(plan).toMatchObject({
      _tag: "Blocked",
      reason: {
        _tag: "Unresolved",
        traits: [{ name: "existing", relationship: "conflict", reason: "Same rule." }]
      }
    })
  }).pipe(Effect.provide(models("conflict")))
)

it.effect("shares explicit segmenter setup, runs executions independently, and closes setup resources", () =>
  Effect.gen(function* () {
    let setups = 0
    let executions = 0
    let executionClosed = 0
    let closed = 0
    const chats: Array<unknown> = []
    const layer = SegmenterRegistry.layer(() =>
      Effect.gen(function* () {
        setups++
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => {
            closed++
          })
        )
        return () =>
          Effect.gen(function* () {
            const chat = yield* Chat.Chat
            chats.push(chat)
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                executionClosed++
              })
            )
            executions++
            return []
          })
      })
    )
    yield* Effect.gen(function* () {
      const get = yield* SegmenterRegistry.SegmenterRegistry
      const module = WorkspacePath.make("extensions/segmenter")
      const [first, second] = yield* Effect.all([get(module), get(module)], { concurrency: "unbounded" })
      const change = { after: { path: WorkspacePath.make("file.ts"), text: "" } }
      yield* first(change)
      yield* second(change)
      expect(setups).toBe(1)
      expect(executions).toBe(2)
      expect(executionClosed).toBe(2)
      expect(chats[0]).not.toBe(chats[1])
      expect(closed).toBe(0)
    }).pipe(Effect.provide(layer))
    expect(closed).toBe(1)
  })
)

it.effect("retains a failed setup until its registry lifetime ends", () =>
  Effect.gen(function* () {
    let attempts = 0
    const failure = SegmenterSetupError.make({ instruction: RecoveryInstruction.make("Configure the extension.") })
    const setup = () =>
      Effect.sync(() => {
        attempts++
      }).pipe(Effect.andThen(Effect.fail(failure)))
    yield* Effect.gen(function* () {
      const get = yield* SegmenterRegistry.SegmenterRegistry
      const module = WorkspacePath.make("extensions/broken")
      const first = yield* get(module).pipe(Effect.flip)
      const second = yield* get(module).pipe(Effect.flip)
      expect(first).toBe(failure)
      expect(second).toBe(failure)
      expect(attempts).toBe(1)
    }).pipe(Effect.provide(SegmenterRegistry.layer(setup)))
  })
)

it.effect("constructs an explicit enrichment registry without filesystem or process services", () =>
  Effect.gen(function* () {
    const get = yield* EnrichmentRegistry.EnrichmentRegistry
    const execute = yield* get(WorkspacePath.make("extensions/enrichment"))
    const text = yield* execute.pipe(
      Effect.provideService(EnrichmentContext, {
        trait: { name: proposal.name, purpose: proposal.purpose },
        input: {
          _tag: "After",
          change: { after: { path: WorkspacePath.make("file.ts"), text: "" } },
          segment: { _tag: "After", range: { start: 0, end: 0 } }
        }
      })
    )
    expect(text).toBe("context")
  }).pipe(Effect.provide(EnrichmentRegistry.layer(() => Effect.succeed(Effect.succeed("context")))))
)
