import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Layer, pipe, Record, Schema as S, Stream } from "effect"
import { AiError, DecisionModel, LanguageModel } from "effect/ai"

import * as WorkspaceDerive from "../local/WorkspaceDerive.ts"
import { WorkspaceRoot } from "../local/WorkspaceRoot.ts"
import * as TraitsDerive from "../mcp/TraitsDerive.ts"
import { TraitAssertion } from "../TraitAssertion.ts"
import * as TraitDerivation from "../TraitDerivation.ts"
import * as TraitFile from "../TraitFile.ts"
import { TraitName } from "../TraitName.ts"
import { TraitPurpose } from "../TraitPurpose.ts"

const proposal = TraitFile.TraitDocument.make({
  name: TraitName.make("proposed"),
  assertion: TraitAssertion.make("Functions are small."),
  purpose: TraitPurpose.make("Keep code readable.")
})

const call = Effect.fn("test.deriveCall")(function* (
  parameters: typeof TraitsDerive.TraitsDerive.parametersSchema.Type
) {
  const { handle } = yield* TraitsDerive.toolkit
  const responses = yield* handle("traits.derive", parameters)
  return yield* Stream.runLast(responses).pipe(Effect.flatMap(Effect.fromOption))
})

/** Real workspace persistence with controlled relationships; each call builds a fresh MCP handler. */
const workspace = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-client-approval-" })
  yield* fs.makeDirectory(`${directory}/traits`)
  const services = Layer.mergeAll(
    NodeServices.layer,
    WorkspaceRoot.layer(directory).pipe(Layer.provide(NodeServices.layer)),
    Layer.effect(
      DecisionModel.DecisionModel,
      DecisionModel.make({
        decide: (options) =>
          Effect.succeed({
            answers: Record.map(options.decisions, () => ({
              _tag: "Classify" as const,
              label: "clarification",
              probabilities: { distinct: 0, covered: 0, clarification: 1, conflict: 0, inconclusive: 0 }
            })),
            usage: { inputTokens: undefined, outputTokens: undefined }
          })
      })
    ),
    Layer.effect(
      LanguageModel.LanguageModel,
      LanguageModel.make({
        generateText: () => Effect.succeed([{ type: "text", text: '{"reasons":[]}' }]),
        streamText: () => Stream.empty
      })
    )
  )
  const deriver = Layer.succeed(WorkspaceDerive.WorkspaceDerive, {
    derive: (documents, approve, progress) =>
      Effect.forEach(documents, (document) => WorkspaceDerive.derive(document, approve, progress), {
        concurrency: 1
      }).pipe(Effect.provide(services))
  })
  const invoke = (parameters: typeof TraitsDerive.TraitsDerive.parametersSchema.Type) =>
    call(parameters).pipe(
      Effect.provide(TraitsDerive.layer.pipe(Layer.provide(deriver))),
      Effect.flatMap((handled) =>
        handled.isFailure
          ? Effect.die(handled.encodedResult)
          : pipe(handled.encodedResult, S.decodeUnknownEffect(TraitsDerive.TraitsDerive.successSchema))
      )
    )
  return { invoke, file: `${directory}/traits/proposed.md` }
})

it.effect(
  "returns client prompting instructions without elicitation, then saves the exact approved snapshot across fresh handlers",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const { invoke, file } = yield* workspace
      const first = yield* invoke({ traits: [proposal] })
      expect(first.instruction).toContain("native question tool or normal conversation")
      const pending = first.results[0]!
      if (!TraitDerivation.TraitDerivation.guards.ApprovalRequired(pending)) {
        return yield* Effect.die("Expected a proposal for client review")
      }
      const { request } = pending
      expect(request.text).toBe(TraitFile.serialize(proposal))
      expect(request.current).toBeNull()
      expect(request.message).toContain(request.text)
      const before = yield* fs.exists(file)
      expect(before).toBe(false)
      const saved = yield* invoke({
        traits: [request.document],
        approvals: [
          {
            name: request.name,
            text: request.text,
            current: request.current,
            decision: TraitDerivation.Approval.cases.Save.make({})
          }
        ]
      })
      expect(saved.results).toEqual([
        TraitDerivation.TraitDerivation.cases.Created.make({ name: proposal.name, path: "traits/proposed.md" })
      ])
      expect(saved.instruction).toBeUndefined()
      const text = yield* fs.readFileString(file)
      expect(text).toBe(request.text)
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
)

it.effect("requires fresh approval for changed proposal text or a changed existing file", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const { invoke, file } = yield* workspace
    const first = yield* invoke({ traits: [proposal] })
    const pending = first.results[0]!
    if (!TraitDerivation.TraitDerivation.guards.ApprovalRequired(pending)) {
      return yield* Effect.die("Expected approval request")
    }
    const approval = {
      name: pending.name,
      text: pending.request.text,
      current: pending.request.current,
      decision: TraitDerivation.Approval.cases.Save.make({})
    }
    const edited = { ...proposal, assertion: TraitAssertion.make("Functions have one responsibility.") }
    const changed = yield* invoke({ traits: [edited], approvals: [approval] })
    expect(changed.results[0]?._tag).toBe("ApprovalRequired")
    const before = yield* fs.exists(file)
    expect(before).toBe(false)
    const localText = TraitFile.serialize(edited)
    yield* fs.writeFileString(file, localText)
    const stale = yield* invoke({ traits: [proposal], approvals: [approval] })
    const result = stale.results[0]!
    if (!TraitDerivation.TraitDerivation.guards.ApprovalRequired(result)) {
      return yield* Effect.die("Expected fresh approval after the existing file changed")
    }
    expect(result.request.current).toBe(localText)
    const untouched = yield* fs.readFileString(file)
    expect(untouched).toBe(localText)
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
)

it.effect("returns Skip and revision decisions without saving", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const { invoke, file } = yield* workspace
    for (const decision of [
      TraitDerivation.Approval.cases.Skip.make({}),
      TraitDerivation.Approval.cases.Revise.make({ feedback: "Narrow the scope." })
    ]) {
      const result = yield* invoke({
        traits: [proposal],
        approvals: [{ name: proposal.name, text: TraitFile.serialize(proposal), current: null, decision }]
      })
      expect(result.results[0]?._tag).toBe(decision._tag === "Skip" ? "Skipped" : "RevisionRequested")
      expect(result.instruction).toBeUndefined()
    }
    const saved = yield* fs.exists(file)
    expect(saved).toBe(false)
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
)

it.effect("keeps provider failures actionable instead of treating failure as a proposal or approval", () =>
  Effect.gen(function* () {
    const failure = AiError.make({
      module: "OpenRouterClient",
      method: "createDecisions",
      reason: AiError.UnknownError.make({
        description: "Insufficient credits. Add more using https://openrouter.ai/settings/credits",
        http: { response: { status: 402, headers: {} } }
      })
    })
    const result = yield* call({ traits: [proposal] }).pipe(
      Effect.provide(
        TraitsDerive.layer.pipe(
          Layer.provide(Layer.succeed(WorkspaceDerive.WorkspaceDerive, { derive: () => Effect.fail(failure) }))
        )
      )
    )
    expect(result.isFailure).toBe(true)
    expect(result.encodedResult).toMatchObject({ message: expect.stringContaining("Insufficient credits") })
  })
)
