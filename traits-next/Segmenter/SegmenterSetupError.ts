import { Schema as S } from "effect"

import { RecoveryInstruction } from "../schema/index.ts"

/** A segmenter initialization failure with required recovery guidance; dependent changes cannot be processed. */
export class SegmenterSetupError extends S.TaggedError<SegmenterSetupError>()("SegmenterSetupError", {
  /** Required actionable guidance for resolving segmenter initialization failure before reevaluation. */
  instruction: RecoveryInstruction.annotateKey({
    description: "Required actionable guidance for resolving segmenter initialization failure before reevaluation."
  })
}) {
  override get message(): string {
    return `Segmenter initialization failed. ${this.instruction}`
  }
}
