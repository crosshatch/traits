import { Effect } from "effect"
import type { Segmenter } from "traits-next"

export default Effect.gen(function* () {
  return Effect.fnUntraced(function* () {
    return []
  })
}) satisfies Segmenter.Segmenter
