import { expect, it } from "@effect/vitest"
import { Effect, pipe, String } from "effect"

import * as TraitFile from "../Trait/TraitFile.ts"

/** The text of a trait file whose prelude nests lists this many levels deep around its one step. */
const deepFile = (depth: number) =>
  `---\nname: a-trait\npurpose: Why.\nprelude: ${pipe("[", String.repeat(depth))}"A step."${pipe("]", String.repeat(depth))}\n---\n`

it.effect("reads the frontmatter as the trait and what follows it as the body, and writes both back as they were", () =>
  Effect.gen(function* () {
    const text = "---\nname: a-trait\nsubject: Notes.\npurpose: Why.\n---\n\nAn example.\n\n---\n\nAfter a rule.\n"
    const trait = yield* TraitFile.parse(text)
    expect(trait).toEqual({
      name: "a-trait",
      subject: "Notes.",
      purpose: "Why.",
      // A --- line after the frontmatter has closed belongs to the body.
      body: "An example.\n\n---\n\nAfter a rule."
    })
    expect(TraitFile.serialize(trait)).toBe(text)
  })
)

it.effect("reads frontmatter whose lines end in CRLF, as Git may check a file out", () =>
  Effect.gen(function* () {
    const trait = yield* TraitFile.parse("---\r\nname: a-trait\r\npurpose: Why.\r\n---\r\n")
    expect(trait).toEqual({ name: "a-trait", purpose: "Why." })
  })
)

it.effect.each([
  ["has no frontmatter", "name: a-trait\npurpose: Why.\n", "it must start with YAML frontmatter between --- lines."],
  ["never closes its frontmatter", "---\nname: a-trait\npurpose: Why.\n", "it must start with YAML frontmatter"],
  ["holds frontmatter that is not YAML", "---\nname: [\n---\n", "its frontmatter is not valid YAML"],
  [
    "has a key that a trait does not, as an outdated file may",
    "---\nname: a-trait\npurpose: Why.\nscope: file\n---\n",
    "its frontmatter does not match the trait schema"
  ]
] as const)("reports a file that %s", ([, text, problem]) =>
  Effect.gen(function* () {
    const error = yield* Effect.flip(TraitFile.parse(text))
    expect(error._tag).toBe("TraitFileParseError")
    expect(error.message).toContain(problem)
  })
)

// Without a limit, validating nesting this deep exhausts the stack, which would stop the process rather than report the file.
it.effect.each([20, 40, 700, 5_000])("reports a file nested %i levels deep, rather than crashing on it", (depth) =>
  Effect.gen(function* () {
    const error = yield* Effect.flip(TraitFile.parse(deepFile(depth)))
    expect(error._tag).toBe("TraitFileParseError")
  })
)
