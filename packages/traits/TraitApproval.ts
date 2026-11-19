import { type Effect, Schema as S } from "effect"

import * as TraitFile from "./TraitFile.ts"
import { TraitName } from "./TraitName.ts"

/** The host's answer to a request to save a proposed trait. */
export type TraitApproval = typeof TraitApproval.Type
export const TraitApproval = S.TaggedUnion({
  /** Return the proposal to the client, which will obtain a decision outside this call. */
  Defer: {},
  Save: {},
  Revise: { feedback: S.String.annotateKey({ description: "What to change." }) },
  Skip: {}
}).annotate({ description: "The user's answer to a request to save a proposed trait." })

/** The complete proposal presented for approval, including current text when replacing a trait. */
export type TraitApprovalRequest = typeof TraitApprovalRequest.Type
export const TraitApprovalRequest = S.Struct({
  name: TraitName,
  action: S.Literals(["Create", "Update"]),
  /** Full review text, including the old and new trait when replacing. */
  message: S.String.annotateKey({ description: "Full review text, including the old and new trait when replacing." }),
  /** Final proposal to pass back when reporting the user's decision. */
  document: TraitFile.TraitDocument.annotateKey({
    description: "Final proposal to pass back when reporting the user's decision."
  }),
  /** Exact proposed Markdown; approval applies only to this text. */
  text: S.String.annotateKey({ description: "Exact proposed Markdown; approval applies only to this text." }),
  /** Exact existing file, or null for a new trait. */
  current: S.String.pipe(S.NullOr).annotateKey({
    description: "Exact existing file, or null for a new trait. Returned with the decision to detect stale approval."
  })
})

/** Host-controlled approval; terminal, web, and MCP hosts supply their own interaction. */
export type Approve<E, R = never> = (request: TraitApprovalRequest) => Effect.Effect<TraitApproval, E, R>
