import { Schema as S } from "effect"

/** Recovery guidance containing at least one non-whitespace character. */
export type RecoveryInstruction = typeof RecoveryInstruction.Type
export const RecoveryInstruction = S.NonEmptyString.check(S.isPattern(/\S/u))
