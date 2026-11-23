import { describe, expect, it } from "@effect/vitest"
import { Effect, pipe, Result, Schema as S, String } from "effect"

import { Trait } from "../Trait/Trait.ts"
import * as TraitFile from "../Trait/TraitFile.ts"
import { TraitPrelude } from "../Trait/TraitPrelude.ts"

/** The failure message of decoding the value as a prelude, or undefined when it decodes. */
const failure = (value: unknown): string | undefined =>
  Result.match(S.decodeUnknownResult(TraitPrelude)(value), {
    onSuccess: () => undefined,
    onFailure: (error) => error.message
  })

const nested = [
  "Fetch the base branch.",
  {
    "package-metadata": ["Read package.json."],
    "changed-files": ["List the changed files.", "Read each one.", { owners: ["Find who owns each file."] }]
  },
  "Summarise what changed."
]

/** The text of a trait file whose frontmatter holds this prelude, written on one line. */
const fileWith = (prelude: string) => `---\nname: a-trait\npurpose: Why.\nprelude: ${prelude}\n---\n`

describe("TraitPrelude", () => {
  it("accepts steps in order, subagents by label, and each nested in the other", () => {
    expect(failure(["A step.", "Another."])).toBeUndefined()
    expect(failure({ uses: ["A step."], "public-api": ["A step.", "Another."] })).toBeUndefined()
    expect(failure(nested)).toBeUndefined()
  })

  it.each([
    ["a single instruction", "A step.", "Expected TraitPreludeSteps | TraitPreludeSubagents"],
    ["no steps", [], "Missing key"],
    ["no subagents", {}, "Expected a value with at least 1 entry"],
    ["a subagent with no steps", { uses: [] }, 'at ["uses"][0]'],
    ["a subagent whose steps are not a list", { uses: "A step." }, 'at ["uses"]'],
    ["a sentence that an unquoted colon turned into a subagent", [{ note: "skip deleted files." }], 'at [0]["note"]'],
    ["steps directly inside steps", ["A step.", ["Another."]], "at [1]"],
    ["subagents directly inside subagents", { uses: { inner: ["A step."] } }, 'at ["uses"]'],
    ["a blank step", ["  "], "Expected text with at least one character that is not whitespace."],
    ["a step that is not text", [1], "at [0]"],
    ["a step that is too long", [pipe("a", String.repeat(301))], "at [0]"],
    ["a label that is not kebab-case", { Not_Kebab: ["A step."], uses: ["Another."] }, 'at ["Not_Kebab"]'],
    [
      "a label used again deeper in the same subagent",
      ["A step.", { uses: ["Another.", { uses: ["A third."] }] }],
      "The label uses is used for more than one subagent."
    ],
    [
      "a label used by two subagents in different places",
      { one: [{ shared: ["A step."] }], two: [{ shared: ["Another."] }] },
      "The label shared is used for more than one subagent."
    ]
  ])("rejects %s", (_name, prelude, message) => {
    expect(failure(prelude)).toContain(message)
  })
})

describe("a trait file's prelude", () => {
  it.effect("is written under its own key after the purpose, and reads back as it was written", () =>
    Effect.gen(function* () {
      const trait = yield* S.decodeUnknownEffect(Trait)({
        name: "a-trait",
        subject: "Notes.",
        purpose: "Why.",
        prelude: nested,
        body: "An example."
      })
      const text = TraitFile.serialize(trait)
      expect(text).toBe(
        pipe(
          `
          |---
          |name: a-trait
          |subject: Notes.
          |purpose: Why.
          |prelude:
          |  - Fetch the base branch.
          |  - package-metadata:
          |      - Read package.json.
          |    changed-files:
          |      - List the changed files.
          |      - Read each one.
          |      - owners:
          |          - Find who owns each file.
          |  - Summarise what changed.
          |---
          |
          |An example.
          |`,
          String.stripMargin,
          String.trimStart
        )
      )
      const read = yield* TraitFile.parse(text)
      expect(read).toEqual(trait)
    })
  )

  it.effect.each([
    ["a colon and a hash", "Run: git log --oneline # recent commits"],
    ["quotes and a leading hyphen", `- "quoted" and 'single'`],
    ["text that reads as another type", "true"],
    ["several lines", "First line.\nSecond line."],
    ["a long line", pipe("A sentence that is long enough to be folded. ", String.repeat(6), String.trim)],
    ["characters outside ASCII", "Naïve café 😀 — ok"]
  ] as const)("reads back exactly what was written for a step with %s", ([, step]) =>
    Effect.gen(function* () {
      const trait = yield* S.decodeEffect(Trait)({
        name: "a-trait",
        purpose: "Why.",
        prelude: { first: [step, { second: [step] }], third: [step] }
      })
      const read = yield* TraitFile.parse(TraitFile.serialize(trait))
      expect(read).toEqual(trait)
    })
  )

  it.effect("is rejected when it is not a valid prelude", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(TraitFile.parse(fileWith("{uses: A step.}")))
      expect(error._tag).toBe("TraitFileParseError")
      expect(error.message).toContain("its frontmatter does not match the trait schema")
    })
  )
})
