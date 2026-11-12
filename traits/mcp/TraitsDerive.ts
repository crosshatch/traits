import { Array, Cause, Effect, Option, pipe, Schema as S, String } from "effect"
import { McpSchema, McpServer, Tool, Toolkit } from "effect/ai"

import * as TraitDerivation from "../TraitDerivation.ts"
import * as TraitFile from "../TraitFile.ts"
import { WorkspaceDerive } from "../WorkspaceDerive.ts"

/** Deriving could not finish; the message says what happened to each proposal and how to proceed. */
export class TraitsDeriveFailure extends S.TaggedError<TraitsDeriveFailure>()("TraitsDeriveFailure", {
  /** What prevented deriving, what was saved, and how to proceed. */
  message: S.String.annotateKey({ description: "What prevented deriving, what was saved, and how to proceed." })
}) {}

/** Proposes traits distilled from user feedback, asks the user to approve each one, and saves the approved ones. */
export const TraitsDerive = Tool.make("traits.derive", {
  description: pipe(
    String.stripMargin(`
  |Propose traits distilled from user feedback that generalizes beyond the current task: a correction, a stated preference, an approved or rejected approach, or a request to remember a convention. Skip one-off decisions, transient facts, and preferences specific to the current task.
  |Give each independent insight its own complete trait: a descriptive kebab-case name, the assertion that should hold, and its purpose; a subject when it applies only to a kind of artifact; and a body only for supporting examples or context, never hidden requirements.
  |Each proposal is compared with the existing traits, then shown to the user in a form to save, revise, or skip; this call returns after the user answers.
  |Results, one per proposal: Created or Updated saved a trait file. Covered, Unresolved, NameTaken, RevisionRequested, and Skipped saved nothing: reuse the covering traits; revise an unresolved proposal with the user, for example into a clarified version of the blocking trait under its name; choose another name; incorporate the feedback, asking for it when absent, and derive again; or stop.
  |Never write trait files yourself to bypass this tool or a skipped proposal.
  `),
    String.trim
  ),
  parameters: S.Struct({
    /** Complete trait proposals, one per independent generalizable insight. */
    traits: S.NonEmptyArray(TraitFile.TraitDocument).annotate({
      description: "Complete trait proposals, one per independent generalizable insight."
    })
  }),
  success: S.Struct({
    /** One outcome per proposal, in order. */
    results: S.Array(TraitDerivation.TraitDerivation).annotate({ description: "One outcome per proposal, in order." })
  }),
  failure: TraitsDeriveFailure,
  failureMode: "return"
})
  .annotate(Tool.Title, "Derive Traits")
  .annotate(Tool.Readonly, false)
  // Saving a clarification replaces an existing trait file.
  .annotate(Tool.Destructive, true)

/** The traits.derive toolkit. */
export const toolkit = Toolkit.make(TraitsDerive)

/** The approval form shown for each proposal. */
const ApprovalForm = S.Struct({
  /** Save the trait as shown, ask for changes, or skip it. */
  decision: S.Literals(["Save", "Revise", "Skip"]).annotate({
    title: "Decision",
    description: "Save the trait as shown, ask for changes, or skip it."
  }),
  /** What to change, when revising. */
  feedback: S.String.annotate({ title: "Feedback", description: "What to change, when revising." }).pipe(S.optionalKey)
})

/** Whether the client can show form elicitations; an empty elicitation capability means forms. */
const supportsForms = (capabilities: McpSchema.ClientCapabilities) =>
  capabilities.elicitation !== undefined &&
  (capabilities.elicitation.form !== undefined || capabilities.elicitation.url === undefined)

/** Asks the user through an elicitation form; dismissing or declining the form skips the proposal. */
const approve = (client: McpSchema.McpServerClient["Service"]) => (request: TraitDerivation.ApprovalRequest) =>
  McpServer.elicit({ message: request.message, schema: ApprovalForm }).pipe(
    Effect.map((answer): TraitDerivation.Approval =>
      answer.decision === "Save"
        ? TraitDerivation.Approval.cases.Save.make({})
        : answer.decision === "Revise"
          ? TraitDerivation.Approval.cases.Revise.make(
              answer.feedback === undefined ? {} : { feedback: answer.feedback }
            )
          : TraitDerivation.Approval.cases.Skip.make({})
    ),
    Effect.catchTags({
      ElicitationDeclined: (declined) =>
        declined.cause === undefined
          ? Effect.succeed(TraitDerivation.Approval.cases.Skip.make({}))
          : TraitsDeriveFailure.make({
              message: `Could not show the approval form for ${request.name}, so nothing was saved: ${globalThis.String(declined.cause)}`
            })
    }),
    // A dismissed form interrupts the request; treat it as skipping this proposal.
    Effect.catchCauseIf(Cause.hasInterruptsOnly, () => Effect.succeed(TraitDerivation.Approval.cases.Skip.make({}))),
    Effect.provideService(McpSchema.McpServerClient, client)
  )

/** The traits.derive handler, asking for approval through the calling client's forms. */
export const layer = toolkit.toLayer(
  Effect.gen(function* () {
    const { derive } = yield* WorkspaceDerive
    return {
      "traits.derive": (parameters) =>
        Effect.gen(function* () {
          const client = yield* Effect.serviceOption(McpSchema.McpServerClient).pipe(Effect.map(Option.getOrUndefined))
          if (client === undefined || !supportsForms(client.clientCapabilities)) {
            return yield* TraitsDeriveFailure.make({
              message: `This client cannot show approval forms (MCP form elicitation), so nothing was saved. Show the user these proposals instead; saving requires a client that supports elicitation.\n\n${pipe(parameters.traits, Array.map(TraitFile.serialize), Array.join("\n"))}`
            })
          }
          const results = yield* derive(parameters.traits, approve(client))
          return { results }
        }).pipe(
          Effect.mapError((error) =>
            error._tag === "TraitsDeriveFailure" ? error : TraitsDeriveFailure.make({ message: error.message })
          ),
          // Without this, the client sees only a generic internal error and cannot act on it.
          Effect.catchDefect((defect) =>
            TraitsDeriveFailure.make({
              message: `Deriving stopped on an unexpected error. Proposals already reported as saved were saved; the rest were not. Report this to the user:\n${Cause.pretty(Cause.die(defect))}`
            })
          )
        )
    }
  })
)
