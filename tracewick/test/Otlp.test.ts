import { effect } from "@effect/vitest"
import { Effect } from "effect"
import { Hex } from "effect/encoding"
import { expect, it } from "vite-plus/test"

import { decode, encodeError, encodeResponse, nanos } from "../otlp.ts"

it("encodes OTLP responses as plain byte arrays", () => {
  expect(encodeResponse(0)).toBeInstanceOf(Uint8Array)
  expect(encodeResponse(0)).toHaveLength(0)
  expect(encodeResponse(2)).toBeInstanceOf(Uint8Array)
  expect(Hex.encode(encodeError("bad"))).toBe("1203626164")
})

effect("keeps malformed input decoding in the typed failure channel", () =>
  Effect.gen(function* () {
    const failed = yield* decode({ signal: "logs", body: new Uint8Array([255]), binary: true }).pipe(Effect.isFailure)
    expect(failed).toBe(true)
  })
)

effect("validates timestamps before applying their pure numeric conversion", () =>
  Effect.gen(function* () {
    const timestamp = yield* nanos("1790000000000000001")
    expect(timestamp).toBe(1790000000000000001n)
    const invalid = yield* nanos("not a timestamp").pipe(Effect.isFailure)
    expect(invalid).toBe(true)
  })
)
