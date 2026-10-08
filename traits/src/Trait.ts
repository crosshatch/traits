import { Array, Crypto, Effect, pipe, Schema as S } from "effect"

import { words } from "./_util/words.ts"

export type TraitId = typeof TraitId.Type
export const TraitId = S.String.pipe(S.brand("traits/Trait"))

export type Trait = typeof Trait.Type
export const Trait = S.Struct({ id: TraitId, body: S.String })

export const makeId = Effect.fn("Trait.makeId")(function* () {
  const crypto = yield* Crypto.Crypto
  let indices: Array<number> = []
  while (indices.length < 3) {
    const index = yield* crypto.randomIntBetween(0, words.length, { halfOpen: true })
    if (!Array.contains(indices, index)) indices = Array.append(indices, index)
  }
  const prefix = pipe(
    indices,
    Array.map((index) => Array.getUnsafe(words, index)),
    Array.join("_")
  )
  const uuid = yield* crypto.randomUUIDv4
  return TraitId.make(`${prefix}-${uuid}`)
})
