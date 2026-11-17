import { expect, it } from "@effect/vitest"
import { Effect, Layer, Stream } from "effect"
import { McpSchema } from "effect/ai"

import { WorkspaceDerive } from "../local/WorkspaceDerive.ts"
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

/** Reports each proposal's approval as the outcome derivation would produce for it, without comparing or saving. */
const deriver = Layer.succeed(WorkspaceDerive, {
  derive: (documents, approve) =>
    Effect.forEach(
      documents,
      (document) =>
        approve({ name: document.name, action: "Create", message: TraitFile.serialize(document) }).pipe(
          Effect.map((approval) =>
            TraitDerivation.Approval.match(approval, {
              Save: () => TraitDerivation.TraitDerivation.cases.Created.make({ name: document.name, path: "saved" }),
              Revise: (revise) =>
                TraitDerivation.TraitDerivation.cases.RevisionRequested.make({
                  name: document.name,
                  feedback: revise.feedback
                }),
              Skip: () => TraitDerivation.TraitDerivation.cases.Skipped.make({ name: document.name })
            })
          )
        ),
      { concurrency: 1 }
    )
})

/** A client that answers every form with result, or none when it cannot show forms. */
const client = (capabilities: McpSchema.ClientCapabilities, result: McpSchema.ElicitResult) =>
  ({
    clientId: 1,
    protocolVersion: "2025-11-25",
    clientCapabilities: capabilities,
    clientInfo: { name: "test", version: "0" },
    getClient: Effect.succeed({ elicit: () => Effect.succeed(result) })
  }) as unknown as McpSchema.McpServerClient["Service"]

const call = (services: Layer.Layer<never>) =>
  Effect.gen(function* () {
    const { handle } = yield* TraitsDerive.toolkit
    const results = yield* handle("traits.derive", { traits: [proposal] })
    return yield* Stream.runLast(results).pipe(Effect.flatMap(Effect.fromOption))
  }).pipe(Effect.provide([TraitsDerive.layer.pipe(Layer.provide(deriver)), services]))

const answered = (result: McpSchema.ElicitResult) =>
  call(Layer.succeed(McpSchema.McpServerClient, client({ elicitation: {} }, result))).pipe(
    Effect.map((handled) => handled.encodedResult)
  )

it.effect("asks for approval in one call through a form, treating declined and dismissed forms as skips", () =>
  Effect.gen(function* () {
    const saved = yield* answered({ action: "accept", content: { decision: "Save" } })
    expect(saved).toMatchObject({ results: [{ _tag: "Created", name: "proposed" }] })
    const skipped = yield* answered({ action: "accept", content: { decision: "Skip" } })
    expect(skipped).toMatchObject({ results: [{ _tag: "Skipped" }] })
    // Blank feedback is no feedback.
    const blank = yield* answered({ action: "accept", content: { decision: "Save", feedback: "  " } })
    expect(blank).toMatchObject({ results: [{ _tag: "Created", name: "proposed" }] })
    // Feedback asks for a revision whichever decision is selected, so nothing the user wants changed is saved.
    for (const decision of ["Save", "Skip"]) {
      const revised = yield* answered({ action: "accept", content: { decision, feedback: " Shorter. " } })
      expect(revised).toMatchObject({ results: [{ _tag: "RevisionRequested", feedback: "Shorter." }] })
    }
    const declined = yield* answered({ action: "decline" })
    expect(declined).toMatchObject({ results: [{ _tag: "Skipped" }] })
    const dismissed = yield* answered({ action: "cancel" })
    expect(dismissed).toMatchObject({ results: [{ _tag: "Skipped" }] })
  })
)

it.effect("explains that clients without forms cannot approve, and returns the proposals", () =>
  Effect.gen(function* () {
    const unsupported = yield* call(Layer.succeed(McpSchema.McpServerClient, client({}, { action: "decline" })))
    expect(unsupported.isFailure).toBe(true)
    const { message } = unsupported.encodedResult as { readonly message: string }
    expect(message).toContain("cannot show approval forms")
    expect(message).toContain(TraitFile.serialize(proposal))
  })
)
