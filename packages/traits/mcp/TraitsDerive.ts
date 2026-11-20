import { Array, Cause, Effect, Option, pipe, Schema as S, String } from "effect"
import { McpSchema, McpServer, Tool, Toolkit } from "effect/ai"

import { WorkspaceDerive } from "../local/WorkspaceDerive.ts"
import type { Progress } from "../local/WorkspaceDerive.ts"
import * as TraitDerivation from "../TraitDerivation.ts"
import * as TraitFile from "../TraitFile.ts"
import { TraitName } from "../TraitName.ts"
import * as ToolFailure from "./ToolFailure.ts"

/** Deriving could not finish; the message explains what happened and how to proceed. */
export class TraitsDeriveFailure extends S.TaggedError<TraitsDeriveFailure>()("TraitsDeriveFailure", {
  /** What prevented deriving, what was saved, and how to proceed. */
  message: S.String.annotateKey({ description: "What prevented deriving, what was saved, and how to proceed." })
}) {}

const description = String.stripMargin(`
|Call this tool proactively when user feedback may contain a reusable lesson, even when it names a specific file or command. Tell the user what you propose. Give each independent insight a complete trait with a descriptive name, assertion, and purpose.
|The first call compares proposals and returns ApprovalRequired for each proposal ready to save. It does not open a form, wait for input, or save those proposals. Follow the returned instruction: show the full proposal and ask the user using the calling client's own prompting mechanism.
|After explicit approval, call again with request.document in traits and an approvals entry containing request.name, request.text, request.current, and the user's decision. Save requires the exact reviewed text and existing-file snapshot to still match. Changed proposals return ApprovalRequired for fresh review. For requested edits use Revise with feedback; for rejection use Skip. Never infer approval from silence.
|Covered, Unresolved, and NameTaken need explanation to the user, not an approval prompt. Only Created or Updated saved a file. Never write trait files yourself to bypass review.
`)

const approvalInstruction = String.stripMargin(`
|For each ApprovalRequired result, display request.message in full and ask the user to Save, Skip, or Revise using your client's native question tool or normal conversation. Do not call an MCP elicitation yourself or ask the user to run another CLI.
|Nothing was saved for those proposals, and no server-side approval is pending. Wait for the user's answer before calling traits.derive again. Include request.document in traits and an approvals entry with name=request.name, text=request.text, current=request.current, and decision={"_tag":"Save"} or {"_tag":"Skip"} or {"_tag":"Revise","feedback":"the user's requested changes"}.
|A Save applies only to the exact reviewed text and snapshot. If a later call returns ApprovalRequired again, ask for fresh approval. A revision is not permission to save changed text: revise the document and submit it for review again.
`)

/** Prepares proposals and accepts client-obtained decisions without retaining pending approvals. */
export const TraitsDerive = Tool.make("traits.derive", {
  description: pipe(description, String.trim),
  parameters: S.Struct({
    /** Complete trait proposals, or the returned documents after review. */
    traits: S.NonEmptyArray(TraitFile.TraitDocument),
    /** Explicit user decisions, bound to the exact proposal and existing-file snapshot shown to them. */
    approvals: S.Array(
      S.Struct({
        name: TraitName,
        text: S.String.annotateKey({ description: "Copy request.text exactly from the proposal the user reviewed." }),
        current: S.String.pipe(S.NullOr).annotateKey({
          description: "Copy request.current exactly; null means the reviewed proposal creates a new file."
        }),
        decision: S.Union([
          TraitDerivation.Approval.cases.Save,
          TraitDerivation.Approval.cases.Skip,
          TraitDerivation.Approval.cases.Revise
        ]).annotateKey({
          description: "The user's explicit decision. Never manufacture approval or infer it from silence."
        })
      })
    )
      .check(
        S.makeFilter(
          (approvals) => new Set(Array.map(approvals, (approval) => approval.name)).size === approvals.length,
          {
            message: "Each trait may have at most one approval decision."
          }
        )
      )
      .pipe(S.optionalKey)
  }),
  success: S.Struct({
    results: S.Array(TraitDerivation.TraitDerivation),
    instruction: S.String.annotateKey({
      description: "Next action for the agent when client-side approval is required."
    }).pipe(S.optionalKey)
  }),
  failure: TraitsDeriveFailure,
  failureMode: "return"
})
  .annotate(Tool.Title, "Derive Traits")
  .annotate(Tool.Readonly, false)
  .annotate(Tool.Destructive, true)

export const toolkit = Toolkit.make(TraitsDerive)

/** Returns control to the agent for prompting; only a matching decision authorizes a save. */
export const layer = toolkit.toLayer(
  Effect.gen(function* () {
    const { derive } = yield* WorkspaceDerive
    return {
      "traits.derive": Effect.fn("TraitsDerive.handle")(function* (parameters) {
        const context = yield* Effect.context<never>()
        const server = yield* Effect.serviceOption(McpServer.McpServer).pipe(Effect.map(Option.getOrUndefined))
        const request = yield* Effect.serviceOption(McpSchema.McpRequestContext).pipe(Effect.map(Option.getOrUndefined))
        const token = pipe(
          request?.requestMetadata?.progressToken,
          S.decodeUnknownOption(McpSchema.ProgressToken),
          Option.getOrUndefined
        )
        let tick = 0
        const progress = Effect.fn("TraitsDerive.progress")(function* (event: Progress) {
          yield* Effect.logInfo(`Trait derivation: ${event.phase} (${event.trait}).`)
          if (server !== undefined && token !== undefined) {
            yield* server.notifications["notifications/progress"]({
              progressToken: token,
              progress: ++tick,
              message: `${event.phase}: ${event.trait}`
            }).pipe(Effect.timeoutOption("1 second"), Effect.ignore, Effect.provideContext(context))
          }
        })
        const results = yield* derive(
          parameters.traits,
          (request) => {
            const approval = pipe(
              parameters.approvals ?? [],
              Array.findFirst((approval) => approval.name === request.name),
              Option.getOrUndefined
            )
            if (
              approval === undefined ||
              (TraitDerivation.Approval.guards.Save(approval.decision) &&
                (approval.text !== request.text || approval.current !== request.current))
            ) {
              return Effect.succeed(TraitDerivation.Approval.cases.Defer.make({}))
            }
            return Effect.succeed(approval.decision)
          },
          progress
        ).pipe(
          Effect.catchCause((cause) =>
            Cause.hasInterruptsOnly(cause)
              ? Effect.interrupt
              : TraitsDeriveFailure.make({
                  message: ToolFailure.describe(cause, {
                    outcome:
                      "Deriving stopped. Earlier explicitly approved proposals may have been saved; proposals requiring approval were not saved.",
                    recovery:
                      "Resolve the reported error, then retry the remaining proposals. Do not treat failure as approval."
                  })
                })
          )
        )
        return {
          results,
          ...(Array.some(results, TraitDerivation.TraitDerivation.guards.ApprovalRequired)
            ? { instruction: pipe(approvalInstruction, String.trim) }
            : {})
        }
      })
    }
  })
)
