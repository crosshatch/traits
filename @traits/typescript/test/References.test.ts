import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"
import { Enrichment, fromSegment, Segment, Trait, TraitName, TraitPurpose, WorkspacePath } from "traits"
import { WorkspaceRoot } from "traits/local"

import setup from "../references/index.ts"

const trait = Trait.Trait.make({
  name: TraitName.TraitName.make("example"),
  purpose: TraitPurpose.TraitPurpose.make("Protect correctness.")
})

it.live("lists the other files referencing each exported declaration", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "traits-references-" })
    yield* fs.writeFileString(
      path.join(root, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true, noEmit: true }, include: ["*.ts"] })
    )
    const errors = "export class Missing extends Error {}\nexport const unused = 1\nconst internal = 2\n"
    yield* fs.writeFileString(path.join(root, "Errors.ts"), errors)
    yield* fs.writeFileString(
      path.join(root, "Parse.ts"),
      'import { Missing } from "./Errors.ts"\nexport const parse = () => new Missing()\nexport const again = () => new Missing()\n'
    )
    const enrich = yield* setup.pipe(Effect.provide(WorkspaceRoot.layer(root)))
    const describe = (change: Parameters<typeof fromSegment>[0], segment: Segment) =>
      Effect.gen(function* () {
        const input = yield* fromSegment(change, segment)
        return yield* enrich.pipe(
          Effect.provideService(Enrichment.EnrichmentContext, { trait, input }),
          Effect.provide(WorkspaceRoot.layer(root))
        )
      })
    const source = { path: WorkspacePath.make("Errors.ts"), text: errors }
    const whole = { start: 0, end: errors.length }
    const listed = yield* describe({ after: source }, Segment.cases.After.make({ range: whole }))
    expect(listed).toContain("- Missing (class): Parse.ts (")
    expect(listed).toContain("- unused (const): no references in other files")
    expect(listed).not.toContain("internal")
    const deleted = yield* describe({ before: source }, Segment.cases.Before.make({ range: whole }))
    expect(deleted).toBe("References are unavailable for a deleted file.")
    const markdown = { path: WorkspacePath.make("README.md"), text: "# Readme" }
    const other = yield* describe({ after: markdown }, Segment.cases.After.make({ range: { start: 0, end: 8 } }))
    expect(other).toBe("")
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
)
