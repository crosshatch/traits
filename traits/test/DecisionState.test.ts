import { expect, it } from "@effect/vitest"

import * as DecisionState from "../DecisionState.ts"
import { Input } from "../util/Input.ts"
import { Segment } from "../util/Segment.ts"
import { WorkspacePath } from "../util/WorkspacePath.ts"

it("sends each decision the target once, its file only when partial, and earlier text only when mapped", () => {
  const before = { path: WorkspacePath.make("old.ts"), text: "const a = 1" }
  const after = { path: WorkspacePath.make("new.ts"), text: "const a = 2\nconst b = 3" }
  const whole = Input.cases.After.make({
    change: { before, after },
    segment: Segment.cases.After.make({ range: { start: 0, end: after.text.length } })
  })
  expect(DecisionState.fromInput(whole)).toEqual({ path: "new.ts", version: "after", target: after.text })
  const mapped = Input.cases.After.make({
    change: { before, after },
    segment: Segment.cases.After.make({ range: { start: 0, end: 11 }, before: [{ start: 0, end: 11 }] })
  })
  expect(DecisionState.fromInput(mapped)).toEqual({
    path: "new.ts",
    version: "after",
    target: "const a = 2",
    source: after.text,
    history: { path: "old.ts", text: before.text, ranges: [{ start: 0, end: 11 }] }
  })
  const deleted = Input.cases.Before.make({
    change: { before },
    segment: Segment.cases.Before.make({ range: { start: 0, end: before.text.length } })
  })
  expect(DecisionState.fromInput(deleted)).toEqual({ path: "old.ts", version: "before", target: before.text })
})
