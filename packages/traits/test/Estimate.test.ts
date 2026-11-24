import { expect, it } from "@effect/vitest"
import { Effect, Schema as S } from "effect"

import * as Estimate from "../Estimate/Estimate.ts"
import * as TraitRun from "../TraitRun/TraitRun.ts"
import { answer, braces, half, name, workspace } from "./_memoryWorkspace.ts"

const files = { "a.ts": "if (x) { y() }", "b.ts": "if (x) y() // BAD", "README.md": "# Title" }

it.effect("gives the least and the most a run can ask, without asking the model or remembering anything", () =>
  Effect.gen(function* () {
    const { layer, project, requests } = yield* workspace({ files, own: [braces], answer })
    const options = { files: project, selections: [], threshold: half }
    const before = yield* Estimate.estimate(options).pipe(Effect.provide(layer))
    const asked = yield* requests
    expect(asked).toEqual([])
    expect(before).toMatchObject({
      traits: [name("always-brace")],
      files: 3,
      skipped: 0,
      // The subject is asked about each file for certain, and the assertion too if it applies to each.
      atLeast: { requests: 3, remembered: 0 },
      atMost: { requests: 6, remembered: 0 }
    })
    expect(before.atLeast.inputTokens).toBeGreaterThan(0)
    expect(before.atMost.inputTokens).toBeGreaterThan(before.atLeast.inputTokens)

    // The README is not a subject match, so the run falls between the two.
    const report = yield* TraitRun.run(options).pipe(Effect.provide(layer))
    expect(report.usage).toMatchObject({ requests: 5, remembered: 0 })

    const after = yield* Estimate.estimate(options).pipe(Effect.provide(layer))
    expect(after.atLeast).toEqual({ requests: 0, inputTokens: 0, preludeTasks: 0, remembered: 5 })
    expect(after.atMost).toEqual(after.atLeast)
    const encoded = yield* S.encodeEffect(Estimate.Estimate)(before)
    expect(Estimate.format(encoded)).toContain("Would check 3 files against 1 traits.\nAt least: 3 requests, about ")
  })
)
