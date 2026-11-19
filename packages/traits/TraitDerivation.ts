import { Array, Data, Effect, Option, pipe, Schema as S, Struct } from "effect"

import { TraitApprovalRequest } from "./TraitApproval.ts"
import * as TraitComparison from "./TraitComparison.ts"
import { BlockedDerivation, TraitDerivationPlan } from "./TraitDerivationPlan.ts"
import * as TraitFile from "./TraitFile.ts"
import { TraitName } from "./TraitName.ts"

export { TraitApproval as Approval, type TraitApprovalRequest as ApprovalRequest } from "./TraitApproval.ts"
export { compare, explain, TraitComparisonError } from "./TraitComparison.ts"
export { TraitDerivationPlan as Plan } from "./TraitDerivationPlan.ts"

/** The outcome for one proposed trait; only Created and Updated write a trait file. */
export type TraitDerivation = typeof TraitDerivation.Type
export const TraitDerivation = S.TaggedUnion({
  Covered: Struct.omit(BlockedDerivation.cases.Covered.fields, ["_tag"]),
  Unresolved: Struct.omit(BlockedDerivation.cases.Unresolved.fields, ["_tag"]),
  NameTaken: Struct.omit(BlockedDerivation.cases.NameTaken.fields, ["_tag"]),
  /** No write occurred; the client must present this proposal and obtain the user's decision. */
  ApprovalRequired: { name: TraitName, request: TraitApprovalRequest },
  /** The host approved a new trait, saved at path. */
  Created: {
    name: TraitName,
    path: S.String.annotate({ description: "The saved trait file, relative to the workspace root." })
  },
  /** The host approved replacing an existing trait, saved under its existing name. */
  Updated: {
    name: TraitName,
    path: S.String.annotate({ description: "The replaced trait file, relative to the workspace root." })
  },
  /** Revise the proposal before saving. */
  RevisionRequested: {
    name: TraitName,
    feedback: S.String.annotateKey({ description: "What the user asked to change." })
  },
  /** The host declined the proposal. */
  Skipped: { name: TraitName }
}).annotate({
  description: "The outcome for one proposed trait; only Created and Updated write a trait file."
})

/** What to do with a proposal after comparison; only Create and Replace need approval. */
export type Resolution = Data.TaggedEnum<{
  readonly Unresolved: {
    readonly traits: Array.NonEmptyReadonlyArray<{
      readonly name: TraitName
      readonly relationship: "conflict" | "inconclusive" | "clarification"
    }>
  }
  readonly Covered: {
    readonly by: Array.NonEmptyReadonlyArray<{ readonly name: TraitName; readonly relationship: "covered" }>
  }
  readonly NameTaken: {}
  readonly Create: {}
  readonly Replace: { readonly name: TraitName; readonly relationship: "covered" | "clarification" }
}>
export const Resolution = Data.taggedEnum<Resolution>()

/** Resolves comparison labels without calling a model or accessing storage. */
export const resolve = Effect.fn("TraitDerivation.resolve")(function* (
  name: TraitName,
  proposal: string,
  existing: ReadonlyArray<{ readonly name: TraitName; readonly text: string }>,
  related: ReadonlyArray<{ readonly name: TraitName; readonly label: keyof typeof TraitComparison.relationships }>
) {
  const blocking = Array.flatMap(related, (entry) =>
    entry.label === "conflict" || entry.label === "inconclusive"
      ? [{ name: entry.name, relationship: entry.label }]
      : []
  )
  if (Array.isArrayNonEmpty(blocking)) {
    return Resolution.Unresolved({ traits: blocking })
  }
  const current = Array.findFirst(existing, (trait) => trait.name === name)
  // A named update competes only with that trait's own covered label.
  const covering = Array.flatMap(related, (entry) =>
    entry.label === "covered" && (Option.isNone(current) || entry.name === name)
      ? [{ name: entry.name, relationship: "covered" as const }]
      : []
  )
  const own = covering.length === 1 && covering[0]?.name === name ? covering[0] : undefined
  const unchanged =
    own !== undefined &&
    (yield* Option.match(current, {
      onNone: () => Effect.succeed(false),
      onSome: (trait) =>
        TraitFile.parse({ path: trait.name, text: trait.text }).pipe(
          // Compare canonical text so formatting alone is not a change.
          Effect.map((parsed) => TraitFile.serialize(parsed) === proposal),
          Effect.orElseSucceed(() => false)
        )
    }))
  const reworded = own !== undefined && !unchanged ? own : undefined
  if (Array.isArrayNonEmpty(covering) && reworded === undefined) {
    return Resolution.Covered({ by: covering })
  }
  if (reworded !== undefined) {
    return Resolution.Replace(reworded)
  }
  const clarifications = Array.flatMap(related, (entry) =>
    entry.label === "clarification" ? [{ name: entry.name, relationship: "clarification" as const }] : []
  )
  // A named clarification replaces its own trait, even if others could also be clarified.
  const clarified = pipe(
    Array.findFirst(clarifications, (entry) => entry.name === name),
    Option.match({ onNone: () => clarifications, onSome: Array.of })
  )
  if (Array.isArrayNonEmpty(clarified) && clarified.length > 1) {
    return Resolution.Unresolved({ traits: clarified })
  }
  const replaced = clarified[0]
  if (replaced !== undefined) {
    return Resolution.Replace(replaced)
  }
  return Option.isSome(current) ? Resolution.NameTaken() : Resolution.Create()
})

/** Compares and explains a proposal without loading files, requesting approval, or writing. Hosts validate extension references and check the approved snapshot before persistence. */
export const prepare = Effect.fn("TraitDerivation.prepare")(function* (
  document: TraitFile.TraitDocument,
  existing: ReadonlyArray<{ readonly name: TraitName; readonly text: string }>
) {
  const proposal = TraitFile.serialize(document)
  const related = yield* TraitComparison.compare(document.name, proposal, existing)
  const resolution = yield* resolve(document.name, proposal, existing, related)
  const explained = Effect.fnUntraced(function* <
    Entry extends { readonly name: TraitName; readonly relationship: string }
  >(entries: Array.NonEmptyReadonlyArray<Entry>) {
    const reasons = yield* TraitComparison.explain(
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
  if (Resolution.$is("Unresolved")(resolution)) {
    const traits = yield* explained(resolution.traits)
    return TraitDerivationPlan.Blocked({
      reason: BlockedDerivation.cases.Unresolved.make({
        name: document.name,
        traits
      })
    })
  }
  if (Resolution.$is("Covered")(resolution)) {
    const covers = yield* explained(resolution.by)
    return TraitDerivationPlan.Blocked({
      reason: BlockedDerivation.cases.Covered.make({
        name: document.name,
        by: Array.map(covers, Struct.pick(["name", "reason"]))
      })
    })
  }
  if (Resolution.$is("NameTaken")(resolution)) {
    return TraitDerivationPlan.Blocked({ reason: BlockedDerivation.cases.NameTaken.make({ name: document.name }) })
  }
  const replaced = Resolution.$is("Replace")(resolution) ? resolution : undefined
  const saved = replaced === undefined ? document : { ...document, name: replaced.name }
  const reason = replaced === undefined ? undefined : (yield* explained([replaced]))[0].reason
  return TraitDerivationPlan.Proposed({
    document: saved,
    text: TraitFile.serialize(saved),
    current: Array.findFirst(existing, (entry) => entry.name === replaced?.name).pipe(
      Option.map((entry) => entry.text),
      Option.getOrUndefined
    ),
    relationship: replaced?.relationship,
    reason
  })
})
