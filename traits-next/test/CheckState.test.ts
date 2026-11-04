import { expect, it } from "@effect/vitest"
import { Effect, pipe, Schema as S } from "effect"

import * as State from "../Check/CheckState.ts"
import * as Report from "../Report/index.ts"
import { Input, ModuleSpecifier } from "../schema/index.ts"
import { Trait } from "../Trait.ts"

it.effect("projects settled enrichment outcomes without losing empty context or including cancelled work", () =>
  Effect.gen(function* () {
    const change = { after: { path: "file.ts", text: "private-source" } }
    const completed = ModuleSpecifier.make("completed")
    const failed = ModuleSpecifier.make("failed")
    const cancelled = ModuleSpecifier.make("cancelled")
    const trait = yield* pipe(
      {
        name: "example",
        purpose: "Protect correctness.",
        enrichments: [completed, failed, cancelled]
      },
      S.decodeEffect(Trait)
    )
    const diagnostic = Report.Diagnostic.cases.Error.make({
      origin: Report.DiagnosticOrigin.cases.EnrichmentExecution.make({ module: failed, trait: 0, input: 0 }),
      error: "Enrichment execution failed."
    })
    const input: State.InputResult = {
      change: 0,
      input: Input.cases.After.make({ change, range: { start: 0, end: change.after.text.length } }),
      status: "Completed",
      enrichments: [
        { module: completed, outcome: State.EnrichmentOutcome.Completed({ text: "" }) },
        { module: failed, outcome: State.EnrichmentOutcome.Failed({ diagnostic, recovery: "Enrichment" }) },
        { module: cancelled, outcome: State.EnrichmentOutcome.Cancelled() }
      ]
    }
    const report = State.toReport({
      changes: [change],
      preparation: { segmenters: new Map(), enrichments: new Map(), segmented: new Map() },
      traits: [{ trait, inputs: [input] }]
    })
    expect(report.traits[0]!.inputs[0]!.enrichments).toEqual([{ module: completed, text: "" }])
    expect(report.diagnostics).toEqual([diagnostic])
    expect(JSON.stringify(report)).not.toContain(change.after.text)
    yield* pipe(report, S.decodeEffect(Report.Report))
  })
)
