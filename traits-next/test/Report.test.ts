import { Schema as S } from "effect"
import { describe, expect, it } from "vite-plus/test"

import * as Report from "../Report/index.ts"

// Raw boundary values intentionally exercise validation rather than schema case constructors.
describe("report contracts", () => {
  it("requires recovery guidance for skipped enrichments", () => {
    const valid = S.is(Report.EnrichmentReport)
    expect(valid({ _tag: "Completed", module: "./context.ts", text: "" })).toBe(true)
    expect(valid({ _tag: "Skipped", module: "./context.ts" })).toBe(false)
    expect(valid({ _tag: "Skipped", module: "./context.ts", instruction: "Configure the context provider." })).toBe(
      true
    )
    expect(valid({ _tag: "Completed", module: "./context.ts" })).toBe(false)
    expect(S.is(Report.Report)({ traits: [], instruction: "Configure the model and retry." })).toBe(true)
    expect(S.is(Report.Report)({ traits: [] })).toBe(true)
  })

  it("ties locations to the selected source's text and UTF-16 bounds", () => {
    const valid = S.is(Report.InputReport)
    const report = {
      source: { path: "example.ts", content: { _tag: "Text", text: "😀" } },
      location: { _tag: "Range", range: { start: 0, end: 2 } },
      enrichments: []
    }
    expect(valid(report)).toBe(true)
    expect(valid({ ...report, location: { _tag: "Range", range: { start: 0, end: 3 } } })).toBe(false)
    const binary = { path: "example.bin", content: { _tag: "Binary", data: new Uint8Array([1, 2]) } }
    expect(valid({ ...report, source: binary })).toBe(false)
    expect(valid({ ...report, source: binary, location: { _tag: "Full" } })).toBe(true)
  })
})
