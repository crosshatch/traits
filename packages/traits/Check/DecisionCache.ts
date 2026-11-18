import { Context, type Effect, type Option, Schema as S } from "effect"

import type { TextDigest } from "../util/TextDigest.ts"

/** A decision a model completed, kept so the same question is not asked again. */
export type CachedDecision = typeof CachedDecision.Type
export const CachedDecision = S.Struct({
  /** The label the model chose. */
  label: S.String.annotateKey({ description: "The label the model chose." }),
  /** The model's probability for each label. */
  probabilities: S.Record(S.String, S.Finite).annotateKey({ description: "The model's probability for each label." }),
  /** The model that made the decision, when its provider reported one. */
  modelId: S.String.annotateKey({
    description: "The model that made the decision, when its provider reported one."
  }).pipe(S.optionalKey)
}).annotate({ description: "A decision a model completed, kept so the same question is not asked again." })

/** Remembers completed subject and assertion decisions by a digest of everything that determines them; hosts scope keys to their decision model. Lookups and writes never fail a check: a broken cache behaves as empty. */
export class DecisionCache extends Context.Service<
  DecisionCache,
  {
    /** The decision stored under key, if any. */
    readonly get: (key: TextDigest) => Effect.Effect<Option.Option<CachedDecision>>
    /** Stores a completed decision under key. */
    readonly set: (key: TextDigest, decision: CachedDecision) => Effect.Effect<void>
  }
>()("traits/Check/DecisionCache") {}
