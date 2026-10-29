import { expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { McpSchema } from "effect/ai"
import { HttpClient, HttpClientResponse } from "effect/http"
import { TestClock } from "effect/testing"

import * as Updates from "../Updates.ts"

it.effect(
  "binds fallback decisions to an offered version and caches registry requests",
  Effect.fnUntraced(function* () {
    let requests = 0
    const client = HttpClient.make((request) => {
      requests++
      return Effect.succeed(HttpClientResponse.fromWeb(request, Response.json({ version: "0.10.0" })))
    })
    const updates = yield* Updates.make({ enabled: true, currentVersion: "0.9.0" }).pipe(
      Effect.provideService(HttpClient.HttpClient, client)
    )
    const unsolicited = yield* updates.gate({ version: "0.10.0", decision: "update" })
    expect(unsolicited?._tag).toBe("UpdateAvailable")
    const stale = yield* updates.gate({ version: "0.9.1", decision: "update" })
    expect(stale?._tag).toBe("UpdateAvailable")
    const approved = yield* updates.gate({ version: "0.10.0", decision: "update" })
    expect(approved?._tag).toBe("UpdateApproved")
    const pending = yield* updates.gate(undefined)
    expect(pending?._tag).toBe("UpdateApproved")
    const deferred = yield* updates.gate({ version: "0.10.0", decision: "later" })
    expect(deferred).toBeUndefined()
    const quiet = yield* updates.gate(undefined)
    expect(quiet).toBeUndefined()
    expect(requests).toBe(1)
    yield* TestClock.adjust("24 hours")
    const reminder = yield* updates.gate(undefined)
    expect(reminder?._tag).toBe("UpdateAvailable")
    expect(requests).toBe(2)
    const skipped = yield* updates.gate({ version: "0.10.0", decision: "skip" })
    expect(skipped).toBeUndefined()
    const suppressed = yield* updates.gate(undefined)
    expect(suppressed).toBeUndefined()
  })
)

it.effect(
  "ignores disabled, non-newer and invalid registry versions without blocking tools",
  Effect.fnUntraced(function* () {
    for (const fixture of [
      { enabled: false, version: "1.0.0" },
      { enabled: true, version: "0.9.0" },
      { enabled: true, version: "0.8.0" },
      { enabled: true, version: "1.0.0-beta.1" },
      { enabled: true, version: "1.0.0; echo unexpected" }
    ]) {
      let requests = 0
      const updates = yield* Updates.make({ enabled: fixture.enabled, currentVersion: "0.9.0" }).pipe(
        Effect.provideService(
          HttpClient.HttpClient,
          HttpClient.make((request) => {
            requests++
            return Effect.succeed(HttpClientResponse.fromWeb(request, Response.json({ version: fixture.version })))
          })
        )
      )
      const result = yield* updates.gate(undefined)
      expect(result).toBeUndefined()
      expect(requests).toBe(fixture.enabled ? 1 : 0)
    }
  })
)

it.effect(
  "fails open on registry timeouts and HTTP errors",
  Effect.fnUntraced(function* () {
    const timedOut = yield* Updates.make({ enabled: true, currentVersion: "0.9.0" }).pipe(
      Effect.provideService(
        HttpClient.HttpClient,
        HttpClient.make(() => Effect.never)
      )
    )
    yield* TestClock.adjust("2 seconds")
    const timeout = yield* timedOut.gate(undefined)
    expect(timeout).toBeUndefined()
    const unavailable = yield* Updates.make({ enabled: true, currentVersion: "0.9.0" }).pipe(
      Effect.provideService(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.succeed(HttpClientResponse.fromWeb(request, new Response("unavailable", { status: 503 })))
        )
      )
    )
    const failure = yield* unavailable.gate(undefined)
    expect(failure).toBeUndefined()
  })
)

it.effect(
  "elicits once for concurrent calls and retains the OpenCode fallback",
  Effect.fnUntraced(function* () {
    let prompts = 0
    const capabilities = { elicitation: { form: {} } }
    const info = { name: "test-client", version: "1" }
    const client = McpSchema.McpServerClient.of({
      clientId: 1,
      protocolVersion: "2025-11-25",
      clientCapabilities: capabilities,
      clientInfo: info,
      initializePayload: { protocolVersion: "2025-11-25", capabilities, clientInfo: info },
      getClient: Effect.succeed({
        listRoots: () => Effect.die("Unexpected roots request"),
        createMessage: () => Effect.die("Unexpected sampling request"),
        elicit: (request) => {
          prompts++
          expect(request.message).toContain("bundled Traits skill")
          return Effect.succeed({ action: "accept" as const, content: { decision: "update" } })
        }
      })
    })
    const make = Updates.make({ enabled: true, currentVersion: "0.9.0" }).pipe(
      Effect.provideService(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.succeed(HttpClientResponse.fromWeb(request, Response.json({ version: "0.10.0" })))
        )
      )
    )
    const updates = yield* make
    const calls = [updates.gate(undefined), updates.gate(undefined)]
    const responses = yield* Effect.all(calls, { concurrency: "unbounded" }).pipe(
      Effect.provideService(McpSchema.McpServerClient, client)
    )
    expect(responses).toMatchObject([{ _tag: "UpdateApproved" }, { _tag: "UpdateApproved" }])
    expect(prompts).toBe(1)
    const fallback = yield* make
    const notice = yield* fallback.gate(undefined).pipe(
      Effect.provideService(McpSchema.McpServerClient, {
        ...client,
        clientInfo: { name: "opencode", version: "1" }
      })
    )
    expect(notice?._tag).toBe("UpdateAvailable")
    expect(prompts).toBe(1)
    const reverse = yield* client.getClient
    const broken = yield* make
    const failedPrompt = yield* broken.gate(undefined).pipe(
      Effect.provideService(McpSchema.McpServerClient, {
        ...client,
        getClient: Effect.succeed({ ...reverse, elicit: () => Effect.die("Client could not show a form") })
      })
    )
    expect(failedPrompt?._tag).toBe("UpdateAvailable")
    const declined = yield* make
    const decline = yield* declined.gate(undefined).pipe(
      Effect.provideService(McpSchema.McpServerClient, {
        ...client,
        getClient: Effect.succeed({ ...reverse, elicit: () => Effect.succeed({ action: "decline" as const }) })
      })
    )
    const afterDecline = yield* declined.gate(undefined)
    expect(decline).toBeUndefined()
    expect(afterDecline).toBeUndefined()
  })
)
