import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Array, Effect, pipe, String } from "effect"
import { HttpClient, HttpClientResponse } from "effect/http"

import { render } from "../Cli/commands/update/update.ts"
import * as Changelog from "../local/Changelog.ts"
import { WorkspaceRoot } from "../local/WorkspaceRoot.ts"
import * as WorkspaceUpdate from "../local/WorkspaceUpdate.ts"

const changelog = String.stripMargin(`
|# traits
|
|## 0.6.0
|
|### Minor Changes
|
|- Rename \`requirement\` to \`assertion\` in trait frontmatter.
|
|## 0.5.15
|
|### Patch Changes
|
|- Fix derivation.
|
|## 0.5.14
|
|### Patch Changes
|
|- Preserve approvals.
|`)

it.effect("loads structured update context without reading workspace files when from is supplied", () =>
  Effect.gen(function* () {
    const requests: Array<string> = []
    const client = HttpClient.make((request) => {
      requests.push(request.url)
      return Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(
            pipe(request.url, String.startsWith("https://registry.npmjs.org/"))
              ? JSON.stringify({ "dist-tags": { latest: "0.6.0" } })
              : changelog
          )
        )
      )
    })
    const context = yield* WorkspaceUpdate.load({ from: "0.5.14" }).pipe(
      Effect.provideService(HttpClient.HttpClient, client)
    )
    expect(context.from).toEqual({ version: "0.5.14", source: "flag" })
    expect(context.latest).toBe("0.6.0")
    expect(Array.map(context.releases, (release) => release.version)).toEqual(["0.5.15", "0.6.0"])
    expect(requests).toHaveLength(2)
  }).pipe(
    Effect.provideService(WorkspaceRoot, { directory: "/nonexistent-workspace" }),
    Effect.provide(NodeServices.layer)
  )
)

it("splits a Changesets changelog into releases and selects a range oldest first", () => {
  const releases = Changelog.parse(changelog)
  expect(Array.map(releases, (release) => release.version)).toEqual(["0.6.0", "0.5.15", "0.5.14"])
  expect(releases[0]!.notes).toBe("### Minor Changes\n\n- Rename `requirement` to `assertion` in trait frontmatter.")
  expect(Array.map(Changelog.between(releases, { from: "0.5.14", to: "0.6.0" }), (release) => release.version)).toEqual(
    ["0.5.15", "0.6.0"]
  )
  expect(
    pipe(
      releases,
      Changelog.between({ from: "0.5.13", to: "0.5.15" }),
      Array.map((release) => release.version)
    )
  ).toEqual(["0.5.14", "0.5.15"])
  expect(Changelog.between(releases, { from: "0.6.0", to: "0.6.0" })).toEqual([])
})

it("renders migration context for an agent, nesting each release's headings under its version", () => {
  const releases = Changelog.between(Changelog.parse(changelog), { from: "0.5.14", to: "0.6.0" })
  const text = render({
    from: { version: "0.5.14", source: "workspace" },
    installed: "0.5.14",
    latest: "0.6.0",
    releases
  })
  expect(text).toContain("- Workspace version (traits/_config.json): 0.5.14")
  expect(text).toContain("1. Upgrade traits to 0.6.0.")
  expect(text).toContain('3. Set "version" in traits/_config.json to 0.6.0.')
  expect(text).toMatch(/### 0\.5\.15[\s\S]*### 0\.6\.0/u)
  expect(text).toContain("### 0.6.0\n\n#### Minor Changes")
  const installedLatest = render({
    from: { version: "0.5.14", source: "flag" },
    installed: "0.6.0",
    latest: "0.6.0",
    releases
  })
  expect(installedLatest).not.toContain("Upgrade traits")
  const upToDate = render({
    from: { version: "0.6.0", source: "installed" },
    installed: "0.6.0",
    latest: "0.6.0",
    releases: []
  })
  expect(upToDate).toContain("no migration is needed")
  expect(upToDate).not.toContain("## Migration")
})
