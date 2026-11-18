import { Context, Effect, FileSystem, Layer, Path, Schema as S, Semaphore } from "effect"

import { CurrentSettings } from "../Settings.ts"
import type { Approve } from "../TraitApproval.ts"
import * as TraitDerivation from "../TraitDerivation.ts"
import * as TraitFile from "../TraitFile.ts"
import type { TraitName } from "../TraitName.ts"
import * as TraitsConfig from "./TraitsConfig.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import * as WorkspaceModels from "./WorkspaceModels.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"
import * as WorkspaceTraits from "./WorkspaceTraits.ts"

/** Asks the user whether to save one proposal; the host supplies it, for example as an MCP elicitation form. */
export type { Approve } from "../TraitApproval.ts"

/** The trait file to be written changed while the user was deciding, so the approval may not match it. */
export class TraitChangedError extends S.TaggedError<TraitChangedError>()("TraitChangedError", {
  /** The trait file, relative to the workspace root. */
  path: S.String.annotateKey({ description: "The trait file, relative to the workspace root." })
}) {
  override get message(): string {
    return `${this.path} changed while waiting for approval, so nothing was saved. Derive the trait again so the user approves it against the current file.`
  }
}

/** Validates a proposed trait, compares it with the workspace's traits, asks the user to approve saving it, and writes it when approved. */
export const derive = Effect.fn("WorkspaceDerive.derive")(function* <E, R>(
  document: TraitFile.TraitDocument,
  approve: Approve<E, R>
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const read = (name: TraitName) => fs.readFileString(path.join(directory, WorkspaceLayout.traitFile(name)))
  const proposal = TraitFile.serialize(document)
  // Validates the proposal as its saved file would be read, including its extension references.
  yield* WorkspaceTraits.decode(document.name, path.join(directory, WorkspaceLayout.traitFile(document.name)), proposal)
  const names = yield* WorkspaceTraits.all
  const { check } = yield* CurrentSettings
  const existing = yield* Effect.forEach(
    names,
    (name) => Effect.map(read(name), (text) => ({ name, text })),
    // Trait files are small, but a workspace can have hundreds.
    { concurrency: check.fileConcurrency }
  )
  const plan = yield* TraitDerivation.prepare(document, existing)
  if (TraitDerivation.Plan.$is("Blocked")(plan)) {
    return plan.reason
  }
  const { document: saved, text, current, reason: why } = plan
  const relative = WorkspaceLayout.traitFile(saved.name)
  const approval = yield* approve({
    name: saved.name,
    action: current === undefined ? "Create" : "Update",
    message:
      current === undefined
        ? `Save this new trait as ${relative}?\n\n${text}`
        : `Replace ${relative} with this ${plan.relationship === "covered" ? "rewording, which keeps its rule" : "clarified version"}?\n\nWhy: ${why ?? ""}\n\nCurrent:\n\n${current}\nReplacement:\n\n${text}`
  })
  if (TraitDerivation.Approval.guards.Revise(approval)) {
    return TraitDerivation.TraitDerivation.cases.RevisionRequested.make({
      name: saved.name,
      feedback: approval.feedback
    })
  }
  if (TraitDerivation.Approval.guards.Skip(approval)) {
    return TraitDerivation.TraitDerivation.cases.Skipped.make({ name: saved.name })
  }
  const file = path.join(directory, relative)
  const now = yield* fs
    .exists(file)
    .pipe(Effect.flatMap((exists) => (exists ? fs.readFileString(file) : Effect.undefined)))
  if (now !== current) {
    return yield* TraitChangedError.make({ path: relative })
  }
  yield* fs.makeDirectory(path.dirname(file), { recursive: true })
  // Written beside the trait file and renamed over it, so a reader never sees a partly written trait.
  yield* fs.makeTempDirectoryScoped({ directory: path.dirname(file), prefix: ".derive-" }).pipe(
    Effect.map((staging) => path.join(staging, "trait")),
    Effect.tap((staged) => fs.writeFileString(staged, text)),
    Effect.flatMap((staged) => fs.rename(staged, file)),
    Effect.scoped
  )
  return current === undefined
    ? TraitDerivation.TraitDerivation.cases.Created.make({ name: saved.name, path: relative })
    : TraitDerivation.TraitDerivation.cases.Updated.make({ name: saved.name, path: relative })
})

/** Derives proposals in order with the workspace's configured models, so each sees traits saved by earlier ones. */
const deriveWorkspace = Effect.fn("WorkspaceDerive.deriveWorkspace")(function* <E>(
  documents: ReadonlyArray<TraitFile.TraitDocument>,
  approve: Approve<E>
) {
  const config = yield* TraitsConfig.load
  return yield* Effect.forEach(documents, (document) => derive(document, approve), { concurrency: 1 }).pipe(
    // The models layer also provides the configuration's settings.
    Effect.provide(WorkspaceModels.layer(config))
  )
})

/** Derives proposed traits into the workspace's trait files after user approval; shared by hosts such as the MCP server. */
export class WorkspaceDerive extends Context.Service<WorkspaceDerive>()("traits/local/WorkspaceDerive", {
  make: Effect.gen(function* () {
    const services = yield* Effect.context<Effect.Services<ReturnType<typeof deriveWorkspace<never>>>>()
    // One derivation at a time, so approvals and writes never interleave.
    const lock = yield* Semaphore.make(1)
    return {
      /** Compares, approves, and saves each proposal in order, reloading the configuration and trait files on every call. */
      derive: <E>(documents: ReadonlyArray<TraitFile.TraitDocument>, approve: Approve<E>) =>
        deriveWorkspace(documents, approve).pipe(lock.withPermits(1), Effect.provideContext(services))
    }
  })
}) {
  /** The deriver; the program provides the platform (filesystem, paths, processes), HTTP, crypto, key-value storage, the time zone, and WorkspaceRoot. */
  static readonly layer = this.make.pipe(Layer.effect(this))
}
