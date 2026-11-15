import {
  Array,
  Clock,
  Duration,
  Effect,
  Exit,
  Layer,
  Order,
  Record,
  Request,
  RequestResolver,
  Schema as S
} from "effect"
import { type AiError, Decision, DecisionModel } from "effect/ai"

import { CurrentSettings } from "./Settings.ts"

/** One decideSettled call, with its input already encoded to the JSON the provider receives. */
class SettledCall extends Request.Class<
  {
    readonly key: string
    readonly state: S.Json
    readonly decisions: Readonly<Record<string, Decision.Any>>
  },
  DecisionModel.DecideSettledResponse<Record<string, Decision.Any>>,
  AiError.AiError
> {}

/** Splits a token count among callers so the shares add up to the count, or leaves it unreported. */
const share = (tokens: number | undefined, index: number, callers: number) =>
  tokens === undefined
    ? undefined
    : Math.floor((tokens * (index + 1)) / callers) - Math.floor((tokens * index) / callers)

/**
 * Wraps the DecisionModel in context so concurrent decideSettled calls that ask the same-named decisions about the same
 * input share one provider request of at most the settings' batch size, collected over its batch window; the input is sent once per request instead of once per call. Each caller receives
 * only its own outcomes, the request's model and metadata, and a share of its token usage, so usage summed over callers
 * equals the provider's. decide is passed through unchanged.
 */
export const layer = Layer.effect(
  DecisionModel.DecisionModel,
  Effect.gen(function* () {
    const model = yield* DecisionModel.DecisionModel
    const { requests } = yield* CurrentSettings
    const resolver = RequestResolver.makeGrouped<SettledCall, string>({
      key: (entry) => entry.request.key,
      resolver: (entries) => {
        // A call merged with no others keeps its decision names, so its request is the one it would have sent alone.
        const merged = (index: number, name: string) => (entries.length === 1 ? name : `${index}.${name}`)
        return model
          .decideSettled(
            Decision.make({
              input: S.Json,
              // Locate decisions name image paths in the encoded input, which Json leaves unchanged, but their types
              // cannot be checked against an untyped input.
              decisions: Record.fromEntries(
                Array.flatMap(entries, (entry, index) =>
                  Array.map(Record.toEntries(entry.request.decisions), ([name, decision]) => [
                    merged(index, name),
                    decision
                  ])
                )
              ) as Record<string, Exclude<Decision.Any, Decision.Locate>>
            }),
            { input: entries[0].request.state }
          )
          .pipe(
            Effect.exit,
            Effect.flatMap((exit) =>
              Effect.sync(() =>
                Array.forEach(entries, (entry, index) =>
                  entry.completeUnsafe(
                    Exit.map(exit, (response) => ({
                      ...response,
                      outcomes: Record.map(
                        entry.request.decisions,
                        (_, name) => response.outcomes[merged(index, name)]!
                      ),
                      usage: DecisionModel.DecisionUsage.make({
                        inputTokens: share(response.usage.inputTokens, index, entries.length),
                        outputTokens: share(response.usage.outputTokens, index, entries.length)
                      })
                    }))
                  )
                )
              )
            )
          )
      }
    }).pipe(
      // Calls about one input arrive over several scheduler ticks, so collect briefly before sending; this is negligible next
      // to model latency. The wait uses the real clock so callers testing under a TestClock are not blocked.
      RequestResolver.setDelayEffect(
        Effect.sleep(Duration.millis(requests.batchWindowMillis)).pipe(
          Effect.provideService(Clock.Clock, Clock.Clock.defaultValue())
        )
      ),
      // Larger groups are split across requests.
      RequestResolver.batchN(requests.batchSize)
    )
    return DecisionModel.DecisionModel.of({
      ...model,
      decideSettled: (definition, options) =>
        S.encodeEffect(S.toCodecJson(definition.input))(options.input).pipe(
          Effect.matchEffect({
            // The model reports the encoding failure in its own terms.
            onFailure: () => model.decideSettled(definition, options),
            onSuccess: (state) =>
              Effect.request(
                new SettledCall({
                  key: JSON.stringify([state, Array.sort(Record.keys(definition.decisions), Order.String)]),
                  state,
                  decisions: definition.decisions
                }),
                resolver
              ) as Effect.Effect<DecisionModel.DecideSettledResponse<typeof definition.decisions>, AiError.AiError>
          })
        )
    })
  })
)
