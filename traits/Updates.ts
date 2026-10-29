import { Clock, Context, Effect, Layer, pipe, Schema as S, Semaphore, SemVer, String } from "effect"
import { McpSchema, McpServer } from "effect/ai"
import { HttpClient, HttpClientResponse } from "effect/http"

import * as Approval from "./_util/Approval.ts"
import PackageJson from "./package.json" with { type: "json" }
import { TraitsContext } from "./TraitsContext.ts"

export const Version = S.String.check(S.isPattern(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/))

export const Decision = S.Struct({
  version: Version.annotate({ description: "Exact latestVersion from the update notice the user answered." }),
  decision: S.Literals(["update", "later", "skip"]).annotate({
    description: "The user's explicit choice: update server and skill, defer for 24 hours, or skip this version."
  })
}).annotate({
  description: "Only supply after asking the user about an UpdateAvailable notice. Separate from trait approval."
})

const noticeFields = {
  currentVersion: S.String,
  latestVersion: Version,
  message: S.String
}

export const Notice = S.TaggedUnion({
  UpdateAvailable: noticeFields,
  UpdateApproved: noticeFields
})

export const latest = Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient
  const response = yield* client
    .get("https://registry.npmjs.org/traits/latest")
    .pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(S.Struct({ version: Version })))
    )
  // SemVer also validates numeric component bounds before a registry value is used.
  yield* S.decodeEffect(S.SemVerFromString)(response.version)
  return response.version
}).pipe(Effect.timeout("2 seconds"))

export const make = Effect.fn("Updates.make")(function* (options: {
  readonly enabled: boolean
  readonly currentVersion: string
}) {
  const client = yield* HttpClient.HttpClient
  const status = yield* Effect.suspend(() => (options.enabled ? latest : Effect.undefined)).pipe(
    Effect.provideService(HttpClient.HttpClient, client),
    Effect.catchTags({
      HttpClientError: () => Effect.undefined,
      SchemaError: () => Effect.undefined,
      TimeoutError: () => Effect.undefined
    }),
    Effect.cachedWithTTL("24 hours")
  )
  yield* status.pipe(Effect.forkScoped)
  const semaphore = yield* Semaphore.make(1)
  let skipped: string | undefined
  let approved: string | undefined
  let offered: string | undefined
  let deferredUntil = 0
  const gate = Effect.fn("Updates.gate")(function* (decision: typeof Decision.Type | undefined) {
    const version = yield* status
    if (version === undefined || version === skipped) return
    const current = yield* S.decodeEffect(S.SemVerFromString)(options.currentVersion)
    const candidate = yield* S.decodeEffect(S.SemVerFromString)(version)
    if (!SemVer.isGreaterThan(candidate, current)) return
    const now = yield* Clock.currentTimeMillis
    if (now < deferredUntil) return
    const message = String.stripMargin(`
    | Update Traits ${options.currentVersion} to ${version}, including its bundled Traits skill and MCP reconnection.
    | Approval excludes overwriting customizations or changing unrelated dependencies.
    | After approval, inspect the installation and every active skill destination. Wait for active Traits calls to finish.
    | For local npm/pnpm/modern Yarn node_modules installs, run the installed CLI externally:
    | traits update --target ${version} --manager <manager> <installed SKILL.md paths...>
    | It installs exactly ${version}, preserves the existing version-range style, synchronizes unmodified snapshots,
    | and verifies linked skills. Reconcile customized or stale snapshots with the user first.
    | For other installations (global, runner, workspace/catalog, PnP), use the owning installation mechanism,
    | then synchronize every active skill from that release's skills/traits/SKILL.md. Never update only the server.
    | Reconnect using the host's supported action. If unavailable, ask the user to restart; never assume respawn.
    | Verify serverInfo.version and installed skill contents. Reload cached skills or start a new conversation as needed.
    | Only then resume the original operation. Report partial failures and remaining manual steps accurately.
    `)
    const question = String.stripMargin(`
    | This operation has not run. Ask the user: Update now / Later (24 hours) / Skip this version.
    | Retry this tool with updateDecision: { version: "${version}", decision: "update" | "later" | "skip" }
    | only after the user chooses. Do not infer consent or reuse trait-save approval.
    `)
    const notice = (_tag: typeof Notice.Type._tag) =>
      Notice.cases[_tag].make({
        currentVersion: options.currentVersion,
        latestVersion: version,
        message:
          _tag === "UpdateAvailable"
            ? `${question}\n${message}`
            : `The user approved this update; the original operation has not run.\n${message}`
      })
    let choice =
      offered === version && decision !== undefined && decision.version === version ? decision.decision : undefined
    if (approved === version && choice === undefined) return notice("UpdateApproved")
    if (choice === undefined) {
      const client = yield* Approval.formClient
      if (client !== undefined) {
        const response = yield* McpServer.elicit({
          message: `Update now, defer 24 hours, or skip this version?\n${message}`,
          schema: S.Struct({
            decision: S.Literals(["update", "later", "skip"]).annotate({
              description: "Update server and skill now, defer 24 hours, or skip this version."
            })
          })
        }).pipe(
          Effect.provideService(McpSchema.McpServerClient, client),
          Effect.map((response) => response.decision),
          Effect.catchTags({
            ElicitationDeclined: (error) => Effect.succeed(error.cause === undefined ? ("later" as const) : undefined)
          })
        )
        choice = response
      }
    }
    if (choice === "skip") {
      skipped = version
      return
    }
    if (choice === "later") {
      approved = undefined
      deferredUntil = now + 24 * 60 * 60 * 1000
      return
    }
    if (choice === "update") {
      offered = version
      approved = version
      return notice("UpdateApproved")
    }
    offered = version
    return notice("UpdateAvailable")
  }, semaphore.withPermits(1))
  return { gate }
})

export class Updates extends Context.Service<Updates, Effect.Success<ReturnType<typeof make>>>()("traits/Updates") {}

export const layer = Layer.effect(
  Updates,
  Effect.gen(function* () {
    const context = yield* TraitsContext
    return yield* make({
      enabled: context.config.checkForUpdates !== false && !pipe(import.meta.url, String.endsWith(".ts")),
      currentVersion: PackageJson.version
    })
  })
)
