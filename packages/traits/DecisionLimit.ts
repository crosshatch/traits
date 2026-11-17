import { Duration, Effect, Layer, Schedule, Semaphore } from "effect"
import { type AiError, DecisionModel } from "effect/ai"

import { CurrentSettings } from "./Settings.ts"

/** Limits simultaneous requests to the decision model in context to the settings' concurrency and retries transient failures, such as rate limits and provider or network errors, with jittered exponential backoff that waits at least as long as a rate limit asks. A request holds its slot while it backs off, so throttling slows the whole check instead of failing queued work. */
export const layer = Layer.effect(
  DecisionModel.DecisionModel,
  Effect.gen(function* () {
    const model = yield* DecisionModel.DecisionModel
    const { concurrency, requests } = yield* CurrentSettings
    const limit = yield* Semaphore.make(concurrency).pipe(
      Effect.map((semaphore) => Semaphore.withPermits(semaphore, 1))
    )
    const backoff = Schedule.exponential(Duration.millis(requests.retryDelayMillis)).pipe(
      Schedule.jittered,
      Schedule.modifyDelay((metadata: Schedule.Metadata<Duration.Duration, AiError.AiError>) =>
        Effect.succeed(
          metadata.input.retryAfter === undefined
            ? metadata.duration
            : Duration.max(metadata.duration, metadata.input.retryAfter)
        )
      )
    )
    const retryTransient = <A, R>(effect: Effect.Effect<A, AiError.AiError, R>) =>
      Effect.retry(effect, {
        schedule: backoff,
        times: requests.retries,
        while: (error) => error.isRetryable
      })
    return DecisionModel.DecisionModel.of({
      ...model,
      decide: (definition, options) => model.decide(definition, options).pipe(retryTransient, limit),
      decideSettled: (definition, options) => model.decideSettled(definition, options).pipe(retryTransient, limit)
    })
  })
)
