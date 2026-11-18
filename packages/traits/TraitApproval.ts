import { type Effect, Schema as S } from "effect"

import type { TraitName } from "./TraitName.ts"

/** The host's answer to a request to save a proposed trait. */
export type TraitApproval = typeof TraitApproval.Type
export const TraitApproval = S.TaggedUnion({
  Save: {},
  Revise: { feedback: S.String.annotateKey({ description: "What to change." }) },
  Skip: {}
}).annotate({ description: "The user's answer to a request to save a proposed trait." })

/** The complete proposal presented for approval, including current text when replacing a trait. */
export interface TraitApprovalRequest {
  readonly name: TraitName
  readonly action: "Create" | "Update"
  readonly message: string
}

/** Host-controlled approval; terminal, web, and MCP hosts supply their own interaction. */
export type Approve<E, R = never> = (request: TraitApprovalRequest) => Effect.Effect<TraitApproval, E, R>
