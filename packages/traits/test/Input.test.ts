import { describe, expect, it } from "@effect/vitest"
import { Effect, Result, Schema as S } from "effect"

import * as Input from "../Input/Input.ts"

/** The failure message of decoding the value, or undefined when it decodes. */
const failure = (schema: S.Top, value: unknown): string | undefined =>
  Result.match(S.decodeUnknownResult(schema as S.Codec<unknown>)(value), {
    onSuccess: () => undefined,
    onFailure: (error) => error.message
  })

const source = (text: string, uri = "file:///workspace/src/a.ts") => ({ uri, text })

/** "😀" takes two UTF-16 code units, at offsets 4 and 5. */
const both = { before: source("old text"), after: source("new 😀 text") }

/** The same change decoded, with URL locations. */
const decoded = {
  before: { ...both.before, uri: new URL(both.before.uri) },
  after: { ...both.after, uri: new URL(both.after.uri) }
}

describe("InputRange", () => {
  it("accepts ordered nonnegative integer offsets, including an empty range", () => {
    expect(failure(Input.InputRange, { start: 0, end: 0 })).toBeUndefined()
    expect(failure(Input.InputRange, { start: 2, end: 9 })).toBeUndefined()
  })

  it.each([
    ["a reversed range", { start: 3, end: 2 }, "Range end must not precede its start."],
    ["a negative offset", { start: -1, end: 2 }, 'at ["start"]'],
    ["a fractional offset", { start: 1.5, end: 2 }, "Expected an integer"],
    ["an unsafe integer", { start: 0, end: 2 ** 53 }, "Expected an integer"],
    ["a string offset", { start: "0", end: 1 }, "Expected number"]
  ])("rejects %s", (_name, range, message) => {
    expect(failure(Input.InputRange, range)).toContain(message)
  })

  it.each([
    [0, 4, undefined],
    [1, 3, undefined],
    [4, 4, undefined],
    [0, 2, "The range end 2 splits a surrogate pair."],
    [2, 3, "The range start 2 splits a surrogate pair."],
    [0, 5, "The range ends at 5, past the end of the text at 4."]
  ])('explains whether [%i, %i) fits "a😀b"', (start, end, reason) => {
    expect(Input.whyInvalidForText({ start, end }, "a😀b")).toBe(reason)
    expect(Input.isValidForText({ start, end }, "a😀b")).toBe(reason === undefined)
  })

  it("treats a lone surrogate as an ordinary code unit", () => {
    expect(Input.isValidForText({ start: 0, end: 2 }, "a\ud83d")).toBe(true)
  })
})

describe("InputSource", () => {
  it.each([
    "file:///Users/me/project/src/a.ts",
    "https://github.com/crosshatch/traits/blob/0e819ec/packages/traits/main.ts",
    "https://example.com/a%20b.ts"
  ])("accepts the URL %s", (uri) => {
    expect(failure(Input.InputSource, { uri, text: "" })).toBeUndefined()
  })

  it.each(["", "src/a.ts", "/etc/passwd", "../outside.ts"])("rejects the path %j", (uri) => {
    expect(failure(Input.InputSource, { uri, text: "" })).toContain("Expected a valid URL string")
  })

  // A Windows drive letter parses as a one-letter scheme.
  it.each(["http://example.com/a.ts", "workspace:/src/a.ts", "C:/a.ts", "C:\\a.ts"])(
    "rejects the scheme of %j",
    (uri) => {
      expect(failure(Input.InputSource, { uri, text: "" })).toContain("Expected a file: or https: URL.")
    }
  )

  it.effect.each([
    ["file:///Users/me/project/src/../a.ts", "file:///Users/me/project/a.ts"],
    ["file:///Users/me/project/my file.ts", "file:///Users/me/project/my%20file.ts"],
    ["HTTPS://Example.com/a/../b.ts", "https://example.com/b.ts"]
  ] as const)("normalizes %j, and encodes it back to a string", ([uri, normalized]) =>
    Effect.gen(function* () {
      const source = yield* S.decodeEffect(Input.InputSource)({ uri, text: "" })
      expect(source.uri).toBeInstanceOf(URL)
      expect(source.uri.href).toBe(normalized)
      const encoded = yield* S.encodeEffect(Input.InputSource)(source)
      expect(encoded).toEqual({ uri: normalized, text: "" })
    })
  )
})

describe("Input", () => {
  const input = (range: unknown, text = "new 😀 text") => ({ version: "after", source: source(text), range })

  it.effect("builds an input from a version, a source and a range, and selects its target text", () =>
    Effect.gen(function* () {
      const made = yield* Input.select("after", decoded.after, { start: 4, end: 6 })
      expect(made.version).toBe("after")
      expect(Input.targetText(made)).toBe("😀")
    })
  )

  it.effect("selects deleted text from a before source", () =>
    Effect.gen(function* () {
      const made = yield* Input.select("before", decoded.before, { start: 4, end: 8 })
      expect(Input.targetText(made)).toBe("text")
    })
  )

  it.effect("fails for a location that is not a file: or https: URL", () =>
    Effect.gen(function* () {
      const error = yield* Input.select(
        "after",
        { uri: new URL("ftp://example.com/a.ts"), text: "abc" },
        { start: 0, end: 3 }
      ).pipe(Effect.flip)
      expect(error.message).toContain('Expected a file: or https: URL.\n  at ["source"]["uri"]')
    })
  )

  it.each([
    [
      "a target past the end of its source",
      input({ start: 0, end: 99 }),
      'The range ends at 99, past the end of the text at 11.\n  at ["range"]'
    ],
    [
      "a target that splits a surrogate pair",
      input({ start: 0, end: 5 }),
      'The range end 5 splits a surrogate pair.\n  at ["range"]'
    ],
    [
      "an empty target in a nonempty source",
      input({ start: 2, end: 2 }),
      'The target range is empty, which is only allowed for an empty source.\n  at ["range"]'
    ],
    ["an unknown version", { ...input({ start: 0, end: 1 }), version: "during" }, 'at ["version"]']
  ])("rejects %s", (_name, value, message) => {
    expect(failure(Input.Input, value)).toContain(message)
  })

  it("accepts an empty target only for an empty source", () => {
    expect(failure(Input.Input, input({ start: 0, end: 0 }, ""))).toBeUndefined()
  })

  it("enforces the same rules when constructing directly", () => {
    expect(() => Input.Input.make({ version: "after", source: decoded.after, range: { start: 0, end: 99 } })).toThrow()
  })
})
