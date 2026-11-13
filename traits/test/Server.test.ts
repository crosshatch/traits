import { NodeServices } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, Layer, Schema as S, Stream } from "effect"
import { HttpClient } from "effect/http"

import type * as WorkspaceCheck from "../local/WorkspaceCheck.ts"
import type * as WorkspaceDerive from "../local/WorkspaceDerive.ts"
import { Server, TraitsCheck, TraitsDerive } from "../mcp/index.ts"

/** A startup failure the user can fix, such as an unreadable workspace. */
class WorkspaceUnavailable extends S.TaggedError<WorkspaceUnavailable>()("WorkspaceUnavailable", {
  message: S.String
}) {}

/** The tool handlers built over workspace services whose construction runs `failure`, plus the host services the tools need. */
const handlersFailingWith = <E>(failure: Effect.Effect<never, E>) =>
  Server.handlers<E, never>(
    Layer.effectDiscard(failure) as Layer.Layer<WorkspaceCheck.WorkspaceCheck | WorkspaceDerive.WorkspaceDerive, E>
  ).pipe(
    Layer.provide([
      NodeServices.layer,
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make(() => Effect.die("The registry is not used when the tools cannot start."))
      )
    ])
  )
const messageOf = (result: { readonly encodedResult: unknown }) =>
  (result.encodedResult as { readonly message: string }).message

it.effect("still answers every tool when its services fail to start, saying what to fix and to restart", () =>
  Effect.gen(function* () {
    const check = yield* TraitsCheck.toolkit
    const derive = yield* TraitsDerive.toolkit
    const checked = yield* check
      .handle("traits.check", {})
      .pipe(Effect.flatMap(Stream.runLast), Effect.flatMap(Effect.fromOption))
    const derived = yield* derive
      .handle("traits.derive", {
        traits: [{ name: "small", purpose: "Keep code readable." }]
      } as never)
      .pipe(Effect.flatMap(Stream.runLast), Effect.flatMap(Effect.fromOption))
    for (const result of [checked, derived]) {
      expect(result.isFailure).toBe(true)
      const message = messageOf(result)
      expect(message).toContain("The workspace directory cannot be read.")
      expect(message).toContain("restart the traits MCP server")
      expect(message).not.toContain("crosshatch/traits")
    }
  }).pipe(
    Effect.provide(
      handlersFailingWith(
        Effect.fail(WorkspaceUnavailable.make({ message: "The workspace directory cannot be read." }))
      )
    )
  )
)

it.effect("offers to report an unexpected startup error as a traits issue", () =>
  Effect.gen(function* () {
    const check = yield* TraitsCheck.toolkit
    const result = yield* check
      .handle("traits.check", {})
      .pipe(Effect.flatMap(Stream.runLast), Effect.flatMap(Effect.fromOption))
    expect(result.isFailure).toBe(true)
    const message = messageOf(result)
    expect(message).toContain("services exploded")
    expect(message).toContain("crosshatch/traits")
    expect(message).toContain("Open it only if they agree")
  }).pipe(Effect.provide(handlersFailingWith(Effect.die(new Error("services exploded")))))
)
