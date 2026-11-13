import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, FileSystem, Layer, Stream } from "effect"
import { HttpClient, HttpClientResponse } from "effect/http"

import * as WorkspaceCheck from "../local/WorkspaceCheck.ts"
import * as TraitsCheck from "../mcp/TraitsCheck.ts"
import PackageJson from "../package.json" with { type: "json" }
import * as Report from "../Report/Report.ts"

/** One traits.check server whose checker is `check`, whose registry reports `latest` as the newest traits release, and whose installed package.json, when given, reports `installed`. */
const server = (check: WorkspaceCheck.WorkspaceCheck["Service"]["check"], latest: string, installed?: string) =>
  TraitsCheck.layer.pipe(
    Layer.provide([
      Layer.succeed(WorkspaceCheck.WorkspaceCheck, { check }),
      installed === undefined
        ? NodeServices.layer
        : Layer.merge(
            NodeServices.layer,
            FileSystem.layerNoop({ readFileString: () => Effect.succeed(JSON.stringify({ version: installed })) })
          ),
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              new Response(JSON.stringify({ "dist-tags": { latest } }), { status: 200 })
            )
          )
        )
      )
    ])
  )
const call = Effect.gen(function* () {
  const toolkit = yield* TraitsCheck.toolkit
  const results = yield* toolkit.handle("traits.check", { paths: ["src/a.ts"] })
  return yield* Stream.runLast(results).pipe(Effect.flatMap(Effect.fromOption))
})
const report = Report.Report.make({
  version: PackageJson.version,
  run: { models: [], usage: {} },
  changes: [],
  diagnostics: [],
  traits: []
})

it.effect("returns check failures and unexpected errors to the client as actionable messages", () =>
  Effect.gen(function* () {
    const declared = yield* call.pipe(
      Effect.provide(
        server(
          () =>
            Effect.fail(
              WorkspaceCheck.WorkspaceFileError.make({ path: "src/a.ts", problem: "it is outside the workspace." })
            ),
          PackageJson.version
        )
      )
    )
    expect(declared.isFailure).toBe(true)
    expect(declared.encodedResult).toMatchObject({ message: "Cannot check src/a.ts: it is outside the workspace." })
    const unexpected = yield* call.pipe(
      Effect.provide(server(() => Effect.die(new Error("model layer exploded")), PackageJson.version))
    )
    expect(unexpected.isFailure).toBe(true)
    expect(unexpected.encodedResult).toMatchObject({ _tag: "TraitsCheckFailure" })
    const { message } = unexpected.encodedResult as { readonly message: string }
    expect(message).toContain("not a pass")
    expect(message).toContain("model layer exploded")
  })
)

it.effect("announces a newer traits release once per server, beside the report", () =>
  Effect.gen(function* () {
    const first = yield* call
    const second = yield* call
    expect(first.encodedResult).toMatchObject({ report: { version: PackageJson.version } })
    const { notice } = first.encodedResult as { readonly notice?: string }
    expect(notice).toContain("traits 999.0.0 is available")
    expect(notice).toContain("traits update")
    expect(second.encodedResult).not.toHaveProperty("notice")
  }).pipe(Effect.provide(server(() => Effect.succeed(report), "999.0.0")))
)

it.effect("gives no notice when the installed release is the latest", () =>
  Effect.gen(function* () {
    const result = yield* call
    expect(result.encodedResult).not.toHaveProperty("notice")
  }).pipe(Effect.provide(server(() => Effect.succeed(report), PackageJson.version)))
)

it.effect("asks for a server restart when the installed package changed under it, also on failures", () =>
  Effect.gen(function* () {
    const succeeded = yield* call.pipe(
      Effect.provide(server(() => Effect.succeed(report), PackageJson.version, "999.0.0"))
    )
    const { notice } = succeeded.encodedResult as { readonly notice?: string }
    expect(notice).toContain("traits 999.0.0 is now installed")
    expect(notice).toContain("restart the traits MCP server")
    const failed = yield* call.pipe(
      Effect.provide(
        server(
          () =>
            Effect.fail(
              WorkspaceCheck.WorkspaceFileError.make({ path: "src/a.ts", problem: "it is outside the workspace." })
            ),
          PackageJson.version,
          "999.0.0"
        )
      )
    )
    expect(failed.isFailure).toBe(true)
    const { message } = failed.encodedResult as { readonly message: string }
    expect(message).toContain("Cannot check src/a.ts")
    expect(message).toContain("restart the traits MCP server")
  })
)
