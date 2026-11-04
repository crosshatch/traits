import { expect, it } from "@effect/vitest"
import { Effect, Exit } from "effect"

import { awaitAbort } from "../Check/Cancellation.ts"
import { Segment } from "../schema/index.ts"
import * as Segmentation from "../Segmenter/Execution.ts"

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
    expect(ordered).toEqual([before, after, later])
    const invalid = Segment.cases.After.make({ range: { start: 0, end: 4 } })
    const exit = yield* Segmentation.execute(() => Effect.succeed([after, invalid]), { after: source }).pipe(
      Effect.exit
    )
    expect(Exit.isFailure(exit)).toBe(true)
    const empty = yield* Segmentation.execute(() => Effect.succeed([]), { after: source })
    expect(empty).toEqual([])
  })
)

it.effect("releases an abort listener when its wait is interrupted", () =>
  Effect.gen(function* () {
    const controller = yield* Effect.sync(() => new AbortController())
    let added = 0
    let removed = 0
    const add = controller.signal.addEventListener.bind(controller.signal)
    const remove = controller.signal.removeEventListener.bind(controller.signal)
    controller.signal.addEventListener = (...args: Parameters<typeof add>) => {
      added++
      add(...args)
    }
    controller.signal.removeEventListener = (...args: Parameters<typeof remove>) => {
      removed++
      remove(...args)
    }
    yield* awaitAbort(controller.signal).pipe(Effect.raceFirst(Effect.yieldNow))
    expect(added).toBe(1)
    expect(removed).toBe(1)
    controller.abort()
    yield* awaitAbort(controller.signal)
  })
)
