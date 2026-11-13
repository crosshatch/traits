#!/usr/bin/env node
/**
 * Measures whether cross-file context changes a trait's accuracy, using small real projects instead of single files.
 *
 * Each eval/scenarios/<id>/ directory is a TypeScript project (with its own tsconfig.json) plus scenario.json naming one
 * workspace trait and labeling some of its files "fail" or "pass". Every labeled file is checked against two variants
 * of the trait, without and with the @traits/typescript/references enrichment, several times with no decision cache, and
 * judged with the fail >= 0.5, pass >= 0.5 policy. A judgment is correct when a "fail" file fails or a "pass" file does
 * not. Run from the repository root: node traits/eval/scenarios.ts [--runs <n>] [--only <scenario>]
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Array, Console, DateTime, Effect, FileSystem, Layer, Path, pipe, Record, Schema as S, String } from "effect"
import { Digest, SecureRandom } from "effect/crypto"
import { FetchHttpClient } from "effect/http"
import { KeyValueStore } from "effect/persistence"

import { check } from "../Check/Check.ts"
import * as ExtensionModule from "../local/ExtensionModule.ts"
import * as LocalEnrichmentRegistry from "../local/LocalEnrichmentRegistry.ts"
import * as LocalSegmenterRegistry from "../local/LocalSegmenterRegistry.ts"
import * as TraitsConfig from "../local/TraitsConfig.ts"
import * as WorkspaceLayout from "../local/WorkspaceLayout.ts"
import * as WorkspaceModels from "../local/WorkspaceModels.ts"
import { WorkspaceRoot } from "../local/WorkspaceRoot.ts"
import * as WorkspaceTraits from "../local/WorkspaceTraits.ts"
import * as Report from "../Report/Report.ts"
import { Trait } from "../Trait.ts"
import { TraitName } from "../TraitName.ts"
import { WorkspacePath } from "../util/util.ts"

const policy = Report.DecisionPolicy.make({ fail: 0.5, pass: 0.5 })

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const scenarios = path.join(import.meta.dirname, "scenarios")
  const runsIndex = process.argv.indexOf("--runs")
  const runs = runsIndex === -1 ? 3 : Number(process.argv[runsIndex + 1])
  const onlyIndex = process.argv.indexOf("--only")
  const ids = yield* fs
    .readDirectory(scenarios)
    .pipe(
      Effect.map(Array.filter((id) => onlyIndex === -1 || id === process.argv[onlyIndex + 1])),
      Effect.map(Array.sort((a: string, b: string) => (a < b ? -1 : 1)))
    )
  const baseUrl = yield* path.toFileUrl(path.join(directory, ".agents", "traits", "scenario.md"))
  const references = yield* ExtensionModule.resolve({ reference: "@traits/typescript/references", baseUrl })
  const totals = new Map<string, { readonly without: number; readonly with: number; readonly judgments: number }>()
  for (const id of ids) {
    const scenario = yield* fs.readFileString(path.join(scenarios, id, "scenario.json")).pipe(
      // The scenario's trait and the expected verdicts for some of its files, keyed by path relative to the scenario.
      Effect.flatMap(
        S.decodeEffect(
          S.fromJsonString(
            S.Struct({
              trait: TraitName,
              labels: S.Record(S.String, S.Literals(["fail", "pass"]))
            })
          )
        )
      )
    )
    const loaded = yield* WorkspaceTraits.load(scenario.trait)
    // Both variants are checked as the workspace's trait file, with or without its references enrichment.
    const origin = Report.TraitOrigin.cases.File.make({
      path: WorkspacePath.make(WorkspaceLayout.traitFile(scenario.trait))
    })
    const others = Array.filter(loaded.enrichments ?? [], (module) => module !== references)
    const { enrichments: _configured, ...definition } = loaded
    const variants = {
      without: Trait.make(Array.isArrayNonEmpty(others) ? { ...definition, enrichments: others } : definition),
      with: Trait.make({ ...definition, enrichments: Array.append(others, references) })
    }
    const files = Record.toEntries(scenario.labels)
    const changes = yield* Effect.forEach(files, ([file]) =>
      Effect.gen(function* () {
        const relative = yield* pipe(
          path.relative(directory, path.join(scenarios, id, file)),
          S.decodeEffect(WorkspacePath)
        )
        const text = yield* fs.readFileString(path.join(directory, relative))
        return { after: { path: relative, text } }
      })
    )
    const correct = { without: 0, with: 0 }
    const rows: Array<string> = []
    for (const [variant, trait] of Record.toEntries(variants)) {
      const verdicts = yield* Effect.forEach(
        Array.range(1, runs),
        () =>
          check({ traits: [{ trait, origin }], changes }).pipe(
            Effect.map((report) =>
              Array.map(Report.verdicts(report, policy).traits[0]!.changes, (change) => change.verdict)
            )
          ),
        { concurrency: runs }
      )
      for (const [index, [file, label]] of files.entries()) {
        const seen = Array.map(verdicts, (run) => run[index]!)
        const right = Array.filter(seen, (verdict) =>
          label === "fail" ? verdict === "Fail" : verdict !== "Fail"
        ).length
        correct[variant] += right
        rows.push(`    ${pipe(variant, String.padEnd(7))} ${file} (${label}): ${Array.join(seen, ", ")}`)
      }
    }
    const judgments = files.length * runs
    const total = totals.get(scenario.trait) ?? { without: 0, with: 0, judgments: 0 }
    totals.set(scenario.trait, {
      without: total.without + correct.without,
      with: total.with + correct.with,
      judgments: total.judgments + judgments
    })
    yield* Console.log(
      `${id} (${scenario.trait}): without ${correct.without}/${judgments}, with references ${correct.with}/${judgments}`
    )
    for (const row of rows) {
      yield* Console.log(row)
    }
  }
  yield* Console.log("\nPer trait (correct judgments without / with references):")
  for (const [trait, total] of totals) {
    yield* Console.log(`  ${trait}: ${total.without}/${total.judgments} -> ${total.with}/${total.judgments}`)
  }
}).pipe(
  Effect.provide(
    Layer.unwrap(
      Effect.map(TraitsConfig.load, (config) =>
        Layer.mergeAll(LocalSegmenterRegistry.layer, LocalEnrichmentRegistry.layer).pipe(
          Layer.provideMerge(WorkspaceModels.layer(config))
        )
      )
    )
  )
)

program.pipe(
  Effect.provide(WorkspaceRoot.layer(".")),
  Effect.provide([
    NodeServices.layer,
    FetchHttpClient.layer,
    Digest.layerWebCrypto,
    SecureRandom.layerWebCrypto,
    KeyValueStore.layerMemory,
    DateTime.layerCurrentZoneLocal
  ]),
  NodeRuntime.runMain
)
