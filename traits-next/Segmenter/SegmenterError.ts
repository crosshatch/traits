import { Schema as S } from "effect"

import { RecoveryInstruction } from "../schema/index.ts"

/** A segmentation execution failure with required recovery guidance; text fallback still applies. */
export class SegmenterError extends S.TaggedError<SegmenterError>()("SegmenterError", {
  /** Required actionable guidance for resolving segmentation execution failure before reevaluation. */
  instruction: RecoveryInstruction.annotateKey({
    description: "Required actionable guidance for resolving segmentation execution failure before reevaluation."
  })
}) {
  override get message(): string {
    return `Segmentation execution failed. ${this.instruction}`
  }
}
