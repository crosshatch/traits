import { expect, it } from "@effect/vitest"
import { Array, Effect, Exit } from "effect"

import { check } from "../Check/Check.ts"
import * as Segmentation from "../Segmenter/Execution.ts"
import { Segment, toSegment } from "../util/index.ts"

it("does not expose an impossible check error channel", () => {
  const infallible: [Effect.Error<ReturnType<typeof check>>] extends [never] ? true : false = true
  expect(infallible).toBe(true)
})

it.effect("validates all segments before returning them in source/range order", () =>
  Effect.gen(function* () {
    const source = { path: "file.ts", text: "abc" }
    const before = Segment.cases.Before.make({ range: { start: 1, end: 2 } })
    const after = Segment.cases.After.make({ range: { start: 0, end: 1 } })
    const later = Segment.cases.After.make({ range: { start: 1, end: 3 } })
    const ordered = yield* Segmentation.execute(() => Effect.succeed([later, after, before]), {
      before: source,
      after: source
    })
    expect(Array.map(ordered, toSegment)).toEqual([before, after, later])
    expect(Array.map(ordered, (input) => input.change)).toEqual(Array.replicate({ before: source, after: source }, 3))
    const invalid = Segment.cases.After.make({ range: { start: 0, end: 4 } })
    const exit = yield* Segmentation.execute(() => Effect.succeed([after, invalid]), { after: source }).pipe(
      Effect.exit
    )
    expect(Exit.isFailure(exit)).toBe(true)
    const empty = yield* Segmentation.execute(() => Effect.succeed([]), { after: source })
    expect(empty).toEqual([])
  })
)
