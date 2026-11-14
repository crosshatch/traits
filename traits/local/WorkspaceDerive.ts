import { Array, Context, Effect, FileSystem, Layer, Option, Path, pipe, Schema as S, Semaphore, Struct } from "effect"

import * as TraitDerivation from "../TraitDerivation.ts"
import * as TraitFile from "../TraitFile.ts"
import type { TraitName } from "../TraitName.ts"
import * as TraitsConfig from "./TraitsConfig.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import * as WorkspaceModels from "./WorkspaceModels.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"
import * as WorkspaceTraits from "./WorkspaceTraits.ts"

/** Asks the user whether to save one proposal; the host supplies it, for example as an MCP elicitation form. */
export type Approve<E> = (request: TraitDerivation.ApprovalRequest) => Effect.Effect<TraitDerivation.Approval, E>

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
  approve: (request: TraitDerivation.ApprovalRequest) => Effect.Effect<TraitDerivation.Approval, E, R>
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const read = (name: TraitName) => fs.readFileString(path.join(directory, WorkspaceLayout.traitFile(name)))
  const proposal = TraitFile.serialize(document)
  // Validates the proposal as its saved file would be read, including its extension references.
  yield* WorkspaceTraits.decode(document.name, path.join(directory, WorkspaceLayout.traitFile(document.name)), proposal)
  const names = yield* WorkspaceTraits.all
  const existing = yield* Effect.forEach(
    names,
    (name) => Effect.map(read(name), (text) => ({ name, text })),
    // Trait files are small, but a workspace can have hundreds.
    { concurrency: 16 }
  )
  const related = yield* TraitDerivation.compare(document.name, proposal, existing)
  /** The reported traits, each with the language model's reason for its relationship to the proposal. */
  const explained = Effect.fnUntraced(function* <
    Entry extends { readonly name: TraitName; readonly relationship: string }
  >(entries: Array.NonEmptyReadonlyArray<Entry>) {
    const reasons = yield* TraitDerivation.explain(
      proposal,
      Array.map(entries, (entry) => ({
        ...entry,
        text: Array.findFirst(existing, (trait) => trait.name === entry.name).pipe(
          Option.map((trait) => trait.text),
          Option.getOrElse(() => "")
        )
      }))
    )
    return Array.map(entries, (entry) => ({ ...entry, reason: reasons[entry.name]! }))
  })
  const blocking = Array.flatMap(related, (entry) =>
    entry.label === "conflict" || entry.label === "inconclusive"
      ? [{ name: entry.name, relationship: entry.label }]
      : []
  )
  if (Array.isArrayNonEmpty(blocking)) {
    const traits = yield* explained(blocking)
    return TraitDerivation.TraitDerivation.cases.Unresolved.make({ name: document.name, traits })
  }
  // A proposal named after an existing trait is a new version of that trait, so only that trait's own label can make
  // it covered; other traits' covered labels do not compete with it, as their clarification labels do not.
  const covering = Array.flatMap(related, (entry) =>
    entry.label === "covered" && (!Array.contains(names, document.name) || entry.name === document.name)
      ? [{ name: entry.name, relationship: "covered" }]
      : []
  )
  // A proposal covered by the trait it is named after rewords that trait without changing its rule. It is offered as
  // an update, like a clarification, unless it would leave the trait's content as it is.
  const own = covering.length === 1 && covering[0]?.name === document.name ? covering[0] : undefined
  const unchanged =
    own !== undefined &&
    (yield* pipe(
      Array.findFirst(existing, (trait) => trait.name === own.name),
      Option.match({
        onNone: () => Effect.succeed(false),
        onSome: (trait) =>
          TraitFile.parse({ path: WorkspaceLayout.traitFile(trait.name), text: trait.text }).pipe(
            // Compared as the file would be written, so formatting alone is not a change.
            Effect.map(
              (parsed) =>
                TraitFile.serialize({
                  ...parsed.frontmatter,
                  ...(parsed.body === undefined ? {} : { body: parsed.body })
                }) === proposal
            ),
            Effect.orElseSucceed(() => false)
          )
      })
    ))
  const reworded = own !== undefined && !unchanged ? own : undefined
  if (Array.isArrayNonEmpty(covering) && reworded === undefined) {
    const covers = yield* explained(covering)
    return TraitDerivation.TraitDerivation.cases.Covered.make({
      name: document.name,
      by: Array.map(covers, Struct.pick(["name", "reason"]))
    })
  }
  const clarifications = Array.flatMap(related, (entry) =>
    entry.label === "clarification" ? [{ name: entry.name, relationship: "clarification" as const }] : []
  )
  // A proposal that rewords or clarifies the trait it is named after replaces that trait, and can replace only one,
  // so other clarification labels do not compete with it.
  const clarified =
    reworded === undefined
      ? pipe(
          Array.findFirst(clarifications, (entry) => entry.name === document.name),
          Option.match({ onNone: () => clarifications, onSome: (named) => [named] })
        )
      : []
  if (Array.isArrayNonEmpty(clarified) && clarified.length > 1) {
    const traits = yield* explained(clarified)
    return TraitDerivation.TraitDerivation.cases.Unresolved.make({ name: document.name, traits })
  }
  const replaced = reworded ?? clarified[0]
  const target = replaced?.name
  if (target === undefined && Array.contains(names, document.name)) {
    return TraitDerivation.TraitDerivation.cases.NameTaken.make({ name: document.name })
  }
  // A clarification or rewording replaces the existing trait under its name.
  const saved = target === undefined ? document : { ...document, name: target }
  const text = TraitFile.serialize(saved)
  const relative = WorkspaceLayout.traitFile(saved.name)
  const current = Array.findFirst(existing, (entry) => entry.name === target).pipe(
    Option.map((entry) => entry.text),
    Option.getOrUndefined
  )
  // The user sees why the proposal counts as a clarification or a rewording before replacing the trait.
  const why = replaced === undefined ? undefined : (yield* explained([replaced]))[0].reason
  const approval = yield* approve({
    name: saved.name,
    action: current === undefined ? "Create" : "Update",
    message:
      current === undefined
        ? `Save this new trait as ${relative}?\n\n${text}`
        : `Replace ${relative} with this ${reworded === undefined ? "clarified version" : "rewording, which keeps its rule"}?\n\nWhy: ${why ?? ""}\n\nCurrent:\n\n${current}\nReplacement:\n\n${text}`
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
  yield* fs.writeFileString(file, text)
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
  return yield* Effect.forEach(documents, (document) => derive(document, approve)).pipe(
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
