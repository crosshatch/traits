import { Effect, type Schema as S } from "effect"
import { Digest } from "effect/crypto"

/** A short name for a JSON value, the same for values that are written as the same JSON. */
export const hash = Effect.fnUntraced(function* (value: S.Json) {
  const digest = yield* Digest.Digest
  return yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(JSON.stringify(value)))
})
