import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Path, Record, Stream } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"

import * as WorkspaceDerive from "../local/WorkspaceDerive.ts"
import { WorkspaceRoot } from "../local/WorkspaceRoot.ts"
import * as WorkspaceTraits from "../local/WorkspaceTraits.ts"
import { TraitAssertion } from "../TraitAssertion.ts"
import { TraitBody } from "../TraitBody.ts"
import * as TraitDerivation from "../TraitDerivation.ts"
import * as TraitFile from "../TraitFile.ts"
import { TraitName } from "../TraitName.ts"
import { TraitPurpose } from "../TraitPurpose.ts"
import { TraitSubject } from "../TraitSubject.ts"

const existing = "---\nname: existing\nassertion: Functions are small.\npurpose: Keep code readable.\n---\n"
const proposal = TraitFile.TraitDocument.make({
  name: TraitName.make("proposed"),
  subject: TraitSubject.make("TypeScript functions."),
  assertion: TraitAssertion.make("Functions have at most one parameter."),
  purpose: TraitPurpose.make("Keep call sites readable."),
  body: TraitBody.make("```diff\n-f(a, b)\n+f({ a, b })\n```")
})

/** A language model that explains only the trait named existing, so other traits get the fallback reason. */
const explainer = LanguageModel.make({
  generateText: () =>
    Effect.succeed([
      {
        type: "text",
        text: JSON.stringify({ reasons: [{ name: "existing", reason: "Both limit how functions are written." }] })
      }
    ]),
  streamText: () => Stream.empty
})

/** A workspace with one saved trait, whose relationship to every proposal the decision model reports as label. */
const workspace = (label: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = yield* fs.makeTempDirectoryScoped({ prefix: "traits-derivation-" })
    yield* fs.makeDirectory(path.join(directory, ".agents", "traits"), { recursive: true })
    yield* fs.writeFileString(path.join(directory, ".agents", "traits", "existing.md"), existing)
    const model = DecisionModel.make({
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
    return {
      directory,
      read: (name: string) => fs.readFileString(path.join(directory, ".agents", "traits", `${name}.md`)),
      exists: (name: string) => fs.exists(path.join(directory, ".agents", "traits", `${name}.md`)),
      services: Layer.mergeAll(
        WorkspaceRoot.layer(directory),
        Layer.effect(DecisionModel.DecisionModel, model),
        Layer.effect(LanguageModel.LanguageModel, explainer)
      )
    }
  })

it.live("saves an approved distinct proposal as a trait file that loads back unchanged", () =>
  Effect.gen(function* () {
    const { exists, read, services } = yield* workspace("distinct")
    const requests: Array<TraitDerivation.ApprovalRequest> = []
    const result = yield* WorkspaceDerive.derive(proposal, (request) =>
      Effect.sync(() => {
        requests.push(request)
        return TraitDerivation.Approval.cases.Save.make({})
      })
    ).pipe(Effect.provide(services))
    expect(result).toEqual(
      TraitDerivation.TraitDerivation.cases.Created.make({ name: proposal.name, path: ".agents/traits/proposed.md" })
    )
    expect(Array.map(requests, (request) => request.action)).toEqual(["Create"])
    const saved = yield* read("proposed")
    expect(requests[0]!.message).toContain(saved)
    const loaded = yield* WorkspaceTraits.load(proposal.name).pipe(Effect.provide(services))
    expect(loaded).toEqual(proposal)
    const untouched = yield* exists("existing")
    expect(untouched).toBe(true)
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
)

it.live("replaces a clarified trait under its existing name after approval", () =>
  Effect.gen(function* () {
    const { exists, read, services } = yield* workspace("clarification")
    const requests: Array<TraitDerivation.ApprovalRequest> = []
    const result = yield* WorkspaceDerive.derive(proposal, (request) =>
      Effect.sync(() => {
        requests.push(request)
        return TraitDerivation.Approval.cases.Save.make({})
      })
    ).pipe(Effect.provide(services))
    expect(result._tag).toBe("Updated")
    expect(requests[0]).toMatchObject({ name: "existing", action: "Update" })
    expect(requests[0]!.message).toContain(existing)
    expect(requests[0]!.message).toContain("Why: Both limit how functions are written.")
    const replaced = yield* read("existing")
    expect(replaced).toContain("name: existing")
    expect(replaced).toContain("Functions have at most one parameter.")
    const separate = yield* exists("proposed")
    expect(separate).toBe(false)
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
)

it.live("replaces the trait a clarification is named after, even when others are also labelled clarifications", () =>
  Effect.gen(function* () {
    const { directory, exists, read, services } = yield* workspace("clarification")
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const other = "---\nname: other\nassertion: Functions are pure.\npurpose: Keep code testable.\n---\n"
    yield* fs.writeFileString(path.join(directory, ".agents", "traits", "other.md"), other)
    const save = () => Effect.succeed(TraitDerivation.Approval.cases.Save.make({}))
    const named = yield* WorkspaceDerive.derive({ ...proposal, name: TraitName.make("existing") }, save).pipe(
      Effect.provide(services)
    )
    expect(named._tag).toBe("Updated")
    const replaced = yield* read("existing")
    expect(replaced).toContain("Functions have at most one parameter.")
    const untouched = yield* read("other")
    expect(untouched).toBe(other)
    // Under a new name, nothing says which of the clarified traits the proposal replaces.
    const unnamed = yield* WorkspaceDerive.derive(proposal, () => Effect.die("approval must not be requested")).pipe(
      Effect.provide(services)
    )
    expect(unnamed).toMatchObject({
      _tag: "Unresolved",
      traits: [
        { name: "existing", relationship: "clarification", reason: "Both limit how functions are written." },
        { name: "other", relationship: "clarification", reason: "The language model gave no reason." }
      ]
    })
    const saved = yield* exists("proposed")
    expect(saved).toBe(false)
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
)

it.live("offers a rewording of the trait it is named after as an update, unless nothing would change", () =>
  Effect.gen(function* () {
    const { directory, read, services } = yield* workspace("covered")
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const same = TraitFile.TraitDocument.make({
      name: TraitName.make("existing"),
      assertion: TraitAssertion.make("Functions are small."),
      purpose: TraitPurpose.make("Keep code readable.")
    })
    // Another trait the model also calls covering does not compete with a new version of the named trait.
    yield* fs.writeFileString(
      path.join(directory, ".agents", "traits", "other.md"),
      "---\nname: other\nassertion: Functions are pure.\npurpose: Keep code testable.\n---\n"
    )
    // The same content in other YAML formatting is not a change.
    const quoted = '---\nname: "existing"\nassertion: "Functions are small."\npurpose: Keep code readable.\n---\n'
    yield* fs.writeFileString(path.join(directory, ".agents", "traits", "existing.md"), quoted)
    const unchanged = yield* WorkspaceDerive.derive(same, () => Effect.die("approval must not be requested")).pipe(
      Effect.provide(services)
    )
    expect(unchanged._tag).toBe("Covered")
    const kept = yield* read("existing")
    expect(kept).toBe(quoted)
    const requests: Array<TraitDerivation.ApprovalRequest> = []
    const reworded = yield* WorkspaceDerive.derive(
      { ...same, purpose: TraitPurpose.make("Keep functions easy to read.") },
      (request) =>
        Effect.sync(() => {
          requests.push(request)
          return TraitDerivation.Approval.cases.Save.make({})
        })
    ).pipe(Effect.provide(services))
    expect(reworded).toEqual(
      TraitDerivation.TraitDerivation.cases.Updated.make({ name: same.name, path: ".agents/traits/existing.md" })
    )
    expect(requests[0]).toMatchObject({ name: "existing", action: "Update" })
    expect(requests[0]!.message).toContain("rewording, which keeps its rule")
    expect(requests[0]!.message).toContain("Why: Both limit how functions are written.")
    expect(requests[0]!.message).toContain(quoted)
    const replaced = yield* read("existing")
    expect(replaced).toContain("Keep functions easy to read.")
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
)

it.live("saves nothing when the proposal is covered, unresolved, renamed onto another trait, revised, or skipped", () =>
  Effect.gen(function* () {
    const unexpected = () => Effect.die("approval must not be requested")
    for (const [label, tag] of [
      ["covered", "Covered"],
      ["conflict", "Unresolved"],
      ["inconclusive", "Unresolved"]
    ] as const) {
      const { exists, services } = yield* workspace(label)
      const result = yield* WorkspaceDerive.derive(proposal, unexpected).pipe(Effect.provide(services))
      expect(result._tag).toBe(tag)
      // The agent learns why each reported trait relates to the proposal, to reconcile them with the user.
      const reported = result._tag === "Covered" ? result.by : result._tag === "Unresolved" ? result.traits : []
      expect(reported).toMatchObject([{ name: "existing", reason: "Both limit how functions are written." }])
      const saved = yield* exists("proposed")
      expect(saved).toBe(false)
    }
    const { exists, read, services } = yield* workspace("distinct")
    const taken = yield* WorkspaceDerive.derive({ ...proposal, name: TraitName.make("existing") }, unexpected).pipe(
      Effect.provide(services)
    )
    expect(taken._tag).toBe("NameTaken")
    const kept = yield* read("existing")
    expect(kept).toBe(existing)
    const revised = yield* WorkspaceDerive.derive(proposal, () =>
      Effect.succeed(TraitDerivation.Approval.cases.Revise.make({ feedback: "Allow two parameters." }))
    ).pipe(Effect.provide(services))
    expect(revised).toEqual(
      TraitDerivation.TraitDerivation.cases.RevisionRequested.make({
        name: proposal.name,
        feedback: "Allow two parameters."
      })
    )
    const skipped = yield* WorkspaceDerive.derive(proposal, () =>
      Effect.succeed(TraitDerivation.Approval.cases.Skip.make({}))
    ).pipe(Effect.provide(services))
    expect(skipped._tag).toBe("Skipped")
    const saved = yield* exists("proposed")
    expect(saved).toBe(false)
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
)

it.live("rejects invalid proposals before asking, and files changed while waiting for approval", () =>
  Effect.gen(function* () {
    const { directory, read, services } = yield* workspace("clarification")
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const unresolvable = yield* WorkspaceDerive.derive({ ...proposal, enrichments: ["../../../outside.ts"] }, () =>
      Effect.die("approval must not be requested")
    ).pipe(Effect.provide(services), Effect.flip)
    expect(unresolvable._tag).toBe("ModuleResolutionError")
    const edited = "---\nname: existing\nassertion: Edited meanwhile.\npurpose: Keep code readable.\n---\n"
    const changed = yield* WorkspaceDerive.derive(proposal, () =>
      fs
        .writeFileString(path.join(directory, ".agents", "traits", "existing.md"), edited)
        .pipe(Effect.as(TraitDerivation.Approval.cases.Save.make({})), Effect.orDie)
    ).pipe(Effect.provide(services), Effect.flip)
    expect(changed._tag).toBe("TraitChangedError")
    const kept = yield* read("existing")
    expect(kept).toBe(edited)
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
)
