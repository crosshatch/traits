import { expect, it } from "@effect/vitest"
import { Effect, Layer, Stream } from "effect"

import * as WorkspaceCheck from "../local/WorkspaceCheck.ts"
import * as TraitsCheck from "../mcp/TraitsCheck.ts"

const handle = (check: WorkspaceCheck.WorkspaceCheck["Service"]["check"]) =>
  Effect.gen(function* () {
    const toolkit = yield* TraitsCheck.toolkit
    const results = yield* toolkit.handle("traits.check", { paths: ["src/a.ts"] })
    return yield* Stream.runLast(results)
  }).pipe(
    Effect.provide(TraitsCheck.layer.pipe(Layer.provide(Layer.succeed(WorkspaceCheck.WorkspaceCheck, { check })))),
    Effect.flatMap(Effect.fromOption)
  )

it.effect("returns check failures and unexpected errors to the client as actionable messages", () =>
  Effect.gen(function* () {
    const declared = yield* handle(() =>
      Effect.fail(WorkspaceCheck.WorkspaceFileError.make({ path: "src/a.ts", problem: "it is outside the workspace." }))
    )
    expect(declared.isFailure).toBe(true)
    expect(declared.encodedResult).toMatchObject({ message: "Cannot check src/a.ts: it is outside the workspace." })
    const unexpected = yield* handle(() => Effect.die(new Error("model layer exploded")))
    expect(unexpected.isFailure).toBe(true)
    expect(unexpected.encodedResult).toMatchObject({ _tag: "TraitsCheckFailure" })
    const { message } = unexpected.encodedResult as { readonly message: string }
    expect(message).toContain("not a pass")
    expect(message).toContain("model layer exploded")
  })
)
