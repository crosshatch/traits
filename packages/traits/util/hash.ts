import { Effect } from "effect"
import { Digest } from "effect/crypto"

/** A short name for a value, the same for the same value. */
export const hash = Effect.fnUntraced(function* (value: unknown) {
  const digest = yield* Digest.Digest
  return yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(JSON.stringify(value)))
})
