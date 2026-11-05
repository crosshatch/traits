import { expect, it } from "@effect/vitest"
import { pipe, Schema as S } from "effect"

import { Input, Segment, targetText, toSegment } from "../util/index.ts"

it("selects the required source and preserves the source-free segment representation", () => {
  const before = { path: "old.ts", text: "😀old" }
  const after = { path: "new.ts", text: "😀new" }
  const deleted = Input.cases.Before.make({ change: { before }, range: { start: 2, end: 5 } })
  const created = Input.cases.After.make({ change: { after }, range: { start: 2, end: 5 } })
  const updated = Input.cases.After.make({
    change: { before, after },
    range: { start: 2, end: 5 },
    before: [{ start: 2, end: 5 }]
  })
  expect(targetText(deleted)).toBe("old")
  expect(targetText(created)).toBe("new")
  expect(targetText(updated)).toBe("new")
  expect(toSegment(updated)).toEqual(
    Segment.cases.After.make({
      range: { start: 2, end: 5 },
      before: [{ start: 2, end: 5 }]
    })
  )
})

it("rejects missing selected sources, invalid UTF-16 ranges, and unavailable historical mappings", () => {
  const source = { path: "file.ts", text: "😀x" }
  for (const invalid of [
    { _tag: "Before", change: { after: source }, range: { start: 0, end: 2 } },
    { _tag: "After", change: { before: source }, range: { start: 0, end: 2 } },
    { _tag: "After", change: { after: source }, range: { start: 1, end: 2 } },
    { _tag: "Before", change: { before: source }, range: { start: 0, end: 4 } },
    { _tag: "After", change: { after: source }, range: { start: 0, end: 2 }, before: [{ start: 0, end: 2 }] },
    {
      _tag: "After",
      change: { before: source, after: source },
      range: { start: 0, end: 2 },
      before: [{ start: 0, end: 1 }]
    }
  ]) {
    expect(pipe(invalid, S.is(Input))).toBe(false)
  }
  expect(() => Input.cases.Before.make({ change: { before: source }, range: { start: 0, end: 4 } })).toThrow()
  expect(() =>
    Input.cases.After.make({
      change: { before: source, after: source },
      range: { start: 0, end: 2 },
      before: [{ start: 0, end: 1 }]
    })
  ).toThrow()
})
