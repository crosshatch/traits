import { expect, it } from "@effect/vitest"
import { Schema as S } from "effect"

import { TraitInput } from "../TraitInput.ts"

const decode = S.decodeUnknownSync(TraitInput)
const snapshot = { path: "example.ts", text: "" }

it("supports added, deleted, and changed files", () => {
  for (const input of [
    { current: snapshot },
    { previous: snapshot },
    { current: snapshot, previous: { path: "previous.ts", text: "previous content" } }
  ]) {
    expect(decode(input)).toEqual(input)
  }
})

it("rejects inputs without either snapshot", () => {
  for (const input of [
    { current: null },
    { current: null, previous: null },
    {},
    { current: undefined, previous: undefined }
  ]) {
    expect(() => decode(input)).toThrow()
  }
})
