import { expect, it } from "@effect/vitest"
import { Effect } from "effect"

import * as Input from "../Input/Input.ts"
import * as Evidence from "../TraitRun/Evidence.ts"

const root = new URL("file:///Users/me/project")
const before = { uri: new URL("file:///Users/me/project/src/old%20name.ts"), text: "old text" }
const after = { uri: new URL("file:///Users/me/project/src/new.ts"), text: "new 😀 text" }

it.effect("carries the target from the version its range selects, never the enclosing files", () =>
  Effect.gen(function* () {
    const current = yield* Input.select("after", after, { start: 0, end: 3 })
    const deleted = yield* Input.select("before", before, { start: 4, end: 8 })
    expect(Evidence.fromInput(current, root)).toEqual({ location: "src/new.ts", version: "after", target: "new" })
    expect(Evidence.fromInput(deleted, root)).toEqual({
      location: "src/old name.ts",
      version: "before",
      target: "text"
    })
  })
)

it.effect.each([
  ["a file outside the workspace", "file:///Users/me/project-two/a.ts", "file:///Users/me/project-two/a.ts"],
  ["a remote file", "https://example.com/project/a.ts", "https://example.com/project/a.ts"],
  ["a name with a stray percent sign", "file:///Users/me/project/100%.ts", "100%.ts"]
] as const)("locates %s without machine-specific parts where it can", ([, uri, location]) =>
  Effect.gen(function* () {
    const input = yield* Input.select("after", { uri: new URL(uri), text: "abc" }, { start: 0, end: 3 })
    expect(Evidence.fromInput(input, root).location).toBe(location)
    expect(Evidence.fromInput(input, new URL("file:///Users/me/project/")).location).toBe(location)
  })
)
