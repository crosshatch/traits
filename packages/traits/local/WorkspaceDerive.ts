import { Context, Effect, FileSystem, Layer, Option, Path, Schema as S, Semaphore } from "effect"

import { CurrentSettings } from "../Settings.ts"
import type { Approve } from "../TraitApproval.ts"
import * as TraitDerivation from "../TraitDerivation.ts"
import * as TraitFile from "../TraitFile.ts"
import { TraitName } from "../TraitName.ts"
import * as TraitsConfig from "./TraitsConfig.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import * as WorkspaceModels from "./WorkspaceModels.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"
import * as WorkspaceTraits from "./WorkspaceTraits.ts"

/** Asks the user whether to save one proposal; the host supplies it, for example as an MCP elicitation form. */
export type { Approve } from "../TraitApproval.ts"

/** Observable work stages; AwaitingApproval invokes the host's approval callback, which may defer to a later call. */
export interface Progress {
  readonly trait: TraitName
  readonly phase: "Reading" | "Comparing" | "AwaitingApproval" | "Saving" | "Completed"
}

/** Reports progress to the calling host without adding an infrastructure dependency to derivation. */
export type OnProgress = (progress: Progress) => Effect.Effect<void>

/** Another request already owns this deriver; callers should resolve it rather than queue invisibly. */
export class DerivationBusy extends S.TaggedError<DerivationBusy>()("DerivationBusy", {}) {
  override get message(): string {
    return "Another trait derivation is executing. Let that call finish or cancel it before retrying. This request did not start or save anything."
  }
}

/** Comparison or client approval exceeded its configured deadline; this proposal was not saved. */
export class DerivationTimedOut extends S.TaggedError<DerivationTimedOut>()("DerivationTimedOut", {
  /** Proposal whose work exceeded the deadline. */
  trait: TraitName.annotateKey({ description: "Proposal whose work exceeded the deadline." }),
  /** Whether the provider or approval UI was being awaited. */
  phase: S.Literals(["Comparing", "AwaitingApproval"]).annotateKey({
    description: "Whether the provider or approval UI was being awaited."
  }),
  /** Configured deadline in milliseconds. */
  milliseconds: S.Int.annotateKey({ description: "Configured deadline in milliseconds." })
}) {
  override get message(): string {
    return this.phase === "Comparing"
      ? `Comparing ${this.trait} timed out after ${this.milliseconds}ms, including provider retries. Nothing was saved for this proposal. Check provider availability or adjust derive.comparisonTimeoutMillis before retrying.`
      : `The host's approval callback for ${this.trait} timed out after ${this.milliseconds}ms. Nothing was saved for this proposal. Retry with a fresh review, or adjust derive.approvalTimeoutMillis.`
  }
}

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
  approve: Approve<E, R>,
  onProgress: OnProgress = () => Effect.void
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  yield* onProgress({ trait: document.name, phase: "Reading" })
  const read = (name: TraitName) => fs.readFileString(path.join(directory, WorkspaceLayout.traitFile(name)))
  const proposal = TraitFile.serialize(document)
  // Validates the proposal as its saved file would be read, including its extension references.
  yield* WorkspaceTraits.decode(document.name, path.join(directory, WorkspaceLayout.traitFile(document.name)), proposal)
  const names = yield* WorkspaceTraits.all
  const { check, derive } = yield* CurrentSettings
  const existing = yield* Effect.forEach(
    names,
    (name) => Effect.map(read(name), (text) => ({ name, text })),
    // Trait files are small, but a workspace can have hundreds.
    { concurrency: check.fileConcurrency }
  )
  yield* onProgress({ trait: document.name, phase: "Comparing" })
  const plan = yield* TraitDerivation.prepare(document, existing).pipe(
    Effect.timeoutOrElse({
      duration: derive.comparisonTimeoutMillis,
      orElse: () =>
        DerivationTimedOut.make({
          trait: document.name,
          phase: "Comparing",
          milliseconds: derive.comparisonTimeoutMillis
        })
    })
  )
  if (TraitDerivation.Plan.$is("Blocked")(plan)) {
    yield* onProgress({ trait: document.name, phase: "Completed" })
    return plan.reason
  }
  const { document: saved, text, current, reason: why } = plan
  const relative = WorkspaceLayout.traitFile(saved.name)
  yield* onProgress({ trait: saved.name, phase: "AwaitingApproval" })
  const request = {
    name: saved.name,
    action: current === undefined ? ("Create" as const) : ("Update" as const),
    document: saved,
    text,
    current: current ?? null,
    message:
      current === undefined
        ? `Save this new trait as ${relative}?\n\n${text}`
        : `Replace ${relative} with this ${plan.relationship === "covered" ? "rewording, which keeps its rule" : "clarified version"}?\n\nWhy: ${why ?? ""}\n\nCurrent:\n\n${current}\nReplacement:\n\n${text}`
  }
  const approval = yield* approve(request).pipe(
    Effect.timeoutOrElse({
      duration: derive.approvalTimeoutMillis,
      orElse: () =>
        DerivationTimedOut.make({
          trait: saved.name,
          phase: "AwaitingApproval",
          milliseconds: derive.approvalTimeoutMillis
        })
    })
  )
  if (TraitDerivation.Approval.guards.Defer(approval)) {
    yield* onProgress({ trait: saved.name, phase: "Completed" })
    return TraitDerivation.TraitDerivation.cases.ApprovalRequired.make({ name: saved.name, request })
  }
  if (TraitDerivation.Approval.guards.Revise(approval)) {
    yield* onProgress({ trait: saved.name, phase: "Completed" })
    return TraitDerivation.TraitDerivation.cases.RevisionRequested.make({
      name: saved.name,
      feedback: approval.feedback
    })
  }
  if (TraitDerivation.Approval.guards.Skip(approval)) {
    yield* onProgress({ trait: saved.name, phase: "Completed" })
    return TraitDerivation.TraitDerivation.cases.Skipped.make({ name: saved.name })
  }
  const file = path.join(directory, relative)
  yield* onProgress({ trait: saved.name, phase: "Saving" })
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
  yield* onProgress({ trait: saved.name, phase: "Completed" })
  return current === undefined
    ? TraitDerivation.TraitDerivation.cases.Created.make({ name: saved.name, path: relative })
    : TraitDerivation.TraitDerivation.cases.Updated.make({ name: saved.name, path: relative })
})

/** Derives proposals in order with the workspace's configured models, so each sees traits saved by earlier ones. */
const deriveWorkspace = Effect.fn("WorkspaceDerive.deriveWorkspace")(function* <E>(
  documents: ReadonlyArray<TraitFile.TraitDocument>,
  approve: Approve<E>,
  onProgress: OnProgress
) {
  const config = yield* TraitsConfig.load
  return yield* Effect.forEach(documents, (document) => derive(document, approve, onProgress), { concurrency: 1 }).pipe(
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
      derive: <E>(
        documents: ReadonlyArray<TraitFile.TraitDocument>,
        approve: Approve<E>,
        onProgress: OnProgress = () => Effect.void
      ) =>
        deriveWorkspace(documents, approve, onProgress).pipe(
          lock.withPermitsIfAvailable(1),
          Effect.flatMap(Option.match({ onNone: () => DerivationBusy.make({}), onSome: Effect.succeed })),
          Effect.provideContext(services)
        )
    }
  })
}) {
  /** The deriver; the program provides the platform (filesystem, paths, processes), HTTP, crypto, key-value storage, the time zone, and WorkspaceRoot. */
  static readonly layer = this.make.pipe(Layer.effect(this))
}
