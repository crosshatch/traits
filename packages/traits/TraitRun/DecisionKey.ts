import { Effect, Schema as S } from "effect"

import { hash } from "../util/hash.ts"

/** What answers are remembered under: a digest of what a request hands the model with its questions, which is the task they share and the evidence they are about. */
export type DecisionKey = typeof DecisionKey.Type
export const DecisionKey = S.String.pipe(S.brand("traits/DecisionKey")).annotate({
  description:
    "What answers are remembered under: a digest of what a request hands the model with its questions, which is the task they share and the evidence they are about."
})

// A key shows a change to what a request hands the model with its questions, and a question's ID shows a change to the question. Neither shows a change to how a request is otherwise put together, such as how many questions it holds or what they go by in it, or to how the provider's library puts it to the model. This is raised with such a change, so that what was answered before it is asked again.
const version = 1

/** The key for the state a request hands the model with its questions. A change to any of it makes another key, which has nothing remembered under it. */
export const fromJson = (state: S.Json) =>
  hash({ version, state }).pipe(Effect.map((digest) => DecisionKey.make(digest)))
