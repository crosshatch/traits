import { describe, expect, it } from "@effect/vitest"
import { Array, Effect } from "effect"

import * as TraitFile from "../Trait/TraitFile.ts"
import { matchesFile, TraitMatchPattern } from "../Trait/TraitMatch.ts"

/** The text of a trait file whose frontmatter holds this match, written on one line. */
const fileWith = (match: string) => `---\nname: a-trait\nmatch: ${match}\npurpose: Why.\n---\n`

describe("a trait's match", () => {
  it.effect.each([
    ["one pattern", '"**/*.ts"', "**/*.ts"],
    ["a list of patterns", '["**/*.ts", "docs/**/*.md"]', ["**/*.ts", "docs/**/*.md"]]
  ] as const)("is read as %s, and reads back as it was written", ([, written, expected]) =>
    Effect.gen(function* () {
      const trait = yield* TraitFile.parse(fileWith(written))
      expect(trait.match).toEqual(expected)
      const again = yield* TraitFile.parse(TraitFile.serialize(trait))
      expect(again).toEqual(trait)
    })
  )

  it.effect.each([
    ["an empty list", "[]"],
    ["a blank pattern", '"  "'],
    ["a blank pattern in a list", '["**/*.ts", ""]'],
    ["a pattern that is not text", "[1]"],
    ["a list inside a list", '[["**/*.ts"]]']
  ] as const)("is rejected when it is %s", ([, written]) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(TraitFile.parse(fileWith(written)))
      expect(error.message).toContain('["match"]')
    })
  )

  it("lets through a file that any one of its patterns matches", () => {
    const matches = matchesFile(
      Array.map(Array.make("**/*.ts", "docs/**/*.md"), (pattern) => TraitMatchPattern.make(pattern))
    )
    expect(Array.map(["src/a.ts", "docs/guide/a.md", "README.md", "src/a.tsx"], matches)).toEqual([
      true,
      true,
      false,
      false
    ])
    expect(matchesFile(TraitMatchPattern.make("**/*.{ts,tsx}"))("src/a.tsx")).toBe(true)
  })
})
