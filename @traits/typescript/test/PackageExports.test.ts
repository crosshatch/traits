import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Path } from "effect"
import { Enrichment, fromSegment, Segment, Trait, TraitName, TraitPurpose, WorkspacePath, WorkspaceRoot } from "traits"

import setup from "../package-exports/index.ts"

const trait = Trait.Trait.make({
  name: TraitName.TraitName.make("example"),
  purpose: TraitPurpose.TraitPurpose.make("Protect correctness.")
})

it.live("states whether a file is an entry point of its nearest package", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "traits-package-exports-" })
    yield* fs.makeDirectory(path.join(root, "pkg", "mcp"), { recursive: true })
    yield* fs.writeFileString(path.join(root, "package.json"), JSON.stringify({ name: "root", private: true }))
    yield* fs.writeFileString(
      path.join(root, "pkg", "package.json"),
      JSON.stringify({ name: "pkg", exports: { ".": "./index.ts", "./mcp": { import: "./mcp/index.ts" } } })
    )
    const enrich = yield* setup.pipe(Effect.provide(WorkspaceRoot.layer(root)))
    const describe = (file: string) =>
      Effect.gen(function* () {
        const change = { after: { path: WorkspacePath.make(file), text: "export {}" } }
        const input = yield* fromSegment(change, Segment.cases.After.make({ range: { start: 0, end: 9 } }))
        return yield* enrich.pipe(
          Effect.provideService(Enrichment.EnrichmentContext, { trait, input }),
          Effect.provide(WorkspaceRoot.layer(root))
        )
      })
    const entry = yield* describe("pkg/mcp/index.ts")
    expect(entry).toContain("pkg/mcp/index.ts is an entry point of package pkg (pkg/package.json)")
    const internal = yield* describe("pkg/util/index.ts")
    expect(internal).toContain("is not a package entry point; it is internal to package pkg")
    const rootFile = yield* describe("scripts/build.ts")
    expect(rootFile).toContain("internal to package root (package.json), which declares no entry points")
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
)
