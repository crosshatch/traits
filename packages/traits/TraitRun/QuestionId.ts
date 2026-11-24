import { Effect, Schema as S } from "effect"

import { hash } from "../util/hash.ts"

/** What a question goes by among those remembered about the same evidence: a digest of the question as it is put to the model. */
export type QuestionId = typeof QuestionId.Type
export const QuestionId = S.String.pipe(S.brand("traits/QuestionId")).annotate({
  description:
    "What a question goes by among those remembered about the same evidence: a digest of the question as it is put to the model."
})

/** The ID of a question, from the question as it is put to the model: what it asks, and what an answer either way means. A change to either makes it another question, which has no answer remembered. */
export const fromQuestion = (question: S.Json) => hash(question).pipe(Effect.map((digest) => QuestionId.make(digest)))
