import { NonBlankString } from "./NonBlankString.ts"

/** Nonblank, actionable guidance for resolving a failure before reevaluation. */
export type RecoveryInstruction = typeof RecoveryInstruction.Type
export const RecoveryInstruction = NonBlankString.annotate({
  description: "Nonblank, actionable guidance for resolving a failure before reevaluation."
})
