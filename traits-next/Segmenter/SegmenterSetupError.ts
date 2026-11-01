import { Schema as S } from "effect"

import { RecoveryInstruction } from "../schema/index.ts"

/** A segmenter initialization failure with required recovery guidance; text fallback still applies. */
export class SegmenterSetupError extends S.TaggedError<SegmenterSetupError>()("SegmenterSetupError", {
  /** Required actionable guidance for resolving segmenter initialization failure before reevaluation. */
  instruction: RecoveryInstruction.annotate({
    description: "Required actionable guidance for resolving segmenter initialization failure before reevaluation."
  })
}) {
  override get message(): string {
    return `Segmenter initialization failed. ${this.instruction}`
  }
}
