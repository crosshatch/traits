import { expect, it } from "@effect/vitest"

import * as DecisionState from "../DecisionState.ts"
import { Input } from "../util/Input.ts"
import { Segment } from "../util/Segment.ts"
import { WorkspacePath } from "../util/WorkspacePath.ts"

it("sends only selected text and mapped historical excerpts, including deleted targets", () => {
  const before = { path: WorkspacePath.make("old.ts"), text: "😀const a = 1\nconst b = 0" }
  const after = { path: WorkspacePath.make("new.ts"), text: "😀const a = 2\nconst b = 3" }
  const whole = Input.cases.After.make({
    change: { before, after },
    segment: Segment.cases.After.make({ range: { start: 0, end: after.text.length } })
  })
  expect(DecisionState.fromInput(whole)).toEqual({ path: "new.ts", version: "after", target: after.text })
  const mapped = Input.cases.After.make({
    change: { before, after },
    segment: Segment.cases.After.make({ range: { start: 2, end: 13 }, before: [{ start: 2, end: 13 }] })
  })
  expect(DecisionState.fromInput(mapped)).toEqual({
    path: "new.ts",
    version: "after",
    target: "const a = 2",
    history: { path: "old.ts", excerpts: ["const a = 1"] }
  })
  const deleted = Input.cases.Before.make({
    change: { before },
    segment: Segment.cases.Before.make({ range: { start: 2, end: 13 } })
  })
  expect(DecisionState.fromInput(deleted)).toEqual({ path: "old.ts", version: "before", target: "const a = 1" })
  const added = Input.cases.After.make({
    change: { before, after },
    segment: Segment.cases.After.make({ range: { start: 2, end: 13 }, before: [] })
  })
  expect(DecisionState.fromInput(added).history).toEqual({ path: "old.ts", excerpts: [] })
  const split = Input.cases.After.make({
    change: { before, after },
    segment: Segment.cases.After.make({
      range: { start: 2, end: 13 },
      before: [
        { start: 2, end: 7 },
        { start: 8, end: 13 }
      ]
    })
  })
  expect(DecisionState.fromInput(split).history).toEqual({ path: "old.ts", excerpts: ["const", "a = 1"] })
  const unrelatedEdit = Input.cases.After.make({
    change: {
      before: { ...before, text: "😀const a = 1\nchanged elsewhere" },
      after: { ...after, text: "😀const a = 2\nchanged elsewhere" }
    },
    segment: mapped.segment
  })
  expect(DecisionState.fromInput(unrelatedEdit)).toEqual(DecisionState.fromInput(mapped))
})
