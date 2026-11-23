import { describe, expect, it } from "@effect/vitest"
import { Array, Effect, pipe, Schema as S, String } from "effect"

import { TraitSourceId } from "../TraitCollection/TraitSourceId.ts"
import * as TraitRun from "../TraitRun/TraitRun.ts"
import { TraitSelectionId, TraitSelectionNotFoundError } from "../TraitSelection/TraitSelections.ts"
import { answer, braces, name, readme, trait, workspace } from "./_memoryWorkspace.ts"

describe("run", () => {
  it.effect(
    "checks each file as a whole against the traits of the default selection, asserting only those that apply",
    () =>
      Effect.gen(function* () {
        const { layer, project, requests } = yield* workspace({
          files: { "src/a.ts": "if (x) y() // BAD", "src/b.ts": "if (x) { y() }", "README.md": "# Title" },
          own: [braces, readme],
          answer
        })
        const report = yield* TraitRun.run({ files: project, selections: [], threshold: 0.5 }).pipe(
          Effect.provide(layer)
        )
        expect(report).toEqual({
          threshold: 0.5,
          traits: [name("always-brace"), name("concise-readme")],
          files: [
            {
              file: "src/a.ts",
              checks: [
                {
                  trait: name("always-brace"),
                  applies: { _tag: "Answered", probability: 0.9 },
                  holds: { _tag: "Answered", probability: 0.2 },
                  verdict: "Violated"
                },
                {
                  trait: name("concise-readme"),
                  applies: { _tag: "Answered", probability: 0.1 },
                  verdict: "NotApplicable"
                }
              ]
            },
            {
              file: "src/b.ts",
              checks: [
                {
                  trait: name("always-brace"),
                  applies: { _tag: "Answered", probability: 0.9 },
                  holds: { _tag: "Answered", probability: 0.8 },
                  verdict: "Holds"
                },
                {
                  trait: name("concise-readme"),
                  applies: { _tag: "Answered", probability: 0.1 },
                  verdict: "NotApplicable"
                }
              ]
            },
            {
              file: "README.md",
              checks: [
                {
                  trait: name("always-brace"),
                  applies: { _tag: "Answered", probability: 0.1 },
                  verdict: "NotApplicable"
                },
                {
                  trait: name("concise-readme"),
                  applies: { _tag: "Answered", probability: 0.9 },
                  holds: { _tag: "Answered", probability: 0.8 },
                  verdict: "Holds"
                }
              ]
            }
          ],
          skipped: [],
          // Two requests per file: one for the subjects, one for the assertions that apply.
          usage: { requests: 6, inputTokens: 60, outputTokens: 6, remembered: 0 }
        })
        const made = yield* requests
        const asserted = Array.filter(Array.flatten(made), ({ assertion }) => assertion !== undefined)
        expect(new Set(asserted)).toEqual(
          new Set([
            {
              assertion: "Every if body has braces.",
              context: "A single-line body still needs braces.",
              target: "if (x) y() // BAD"
            },
            {
              assertion: "Every if body has braces.",
              context: "A single-line body still needs braces.",
              target: "if (x) { y() }"
            },
            { assertion: "The README is short.", target: "# Title" }
          ])
        )
      })
  )

  it.effect(
    "skips files without text, applies a trait with no subject everywhere, and leaves out one with no assertion",
    () =>
      Effect.gen(function* () {
        const everywhere = trait({ name: "no-secrets", assertion: "The file holds no secrets." })
        const guidance = trait({ name: "guidance-only", subject: "TypeScript if statements." })
        const { layer, project, requests } = yield* workspace({
          files: { "a.ts": "if (x) { y() }", "logo.png": undefined, "empty.ts": "  \n" },
          own: [everywhere, guidance],
          answer
        })
        const report = yield* TraitRun.run({ files: project, selections: [], threshold: 0.5 }).pipe(
          Effect.provide(layer)
        )
        expect(report.traits).toEqual([name("no-secrets")])
        expect(report.skipped).toEqual(["logo.png", "empty.ts"])
        expect(report.files).toEqual([
          {
            file: "a.ts",
            checks: [{ trait: name("no-secrets"), holds: { _tag: "Answered", probability: 0.8 }, verdict: "Holds" }]
          }
        ])
        const made = yield* requests
        expect(made).toEqual([[{ assertion: "The file holds no secrets.", target: "if (x) { y() }" }]])
      })
  )

  it.effect("runs the traits the selections refer to, each once, from the workspace and from sources", () =>
    Effect.gen(function* () {
      const sourced = trait({
        name: "always-brace",
        subject: "TypeScript if statements.",
        assertion: "Sourced assertion."
      })
      const { layer, project, requests } = yield* workspace({
        files: { "a.ts": "if (x) { y() }" },
        own: [braces, readme],
        sourced: { effect: [sourced] },
        selections: { ci: ["always-brace", "effect/always-brace"], docs: ["concise-readme", "always-brace"] },
        answer
      })
      const ids = [TraitSelectionId.make("ci"), TraitSelectionId.make("docs")]
      const report = yield* TraitRun.run({ files: project, selections: ids, threshold: 0.5 }).pipe(
        Effect.provide(layer)
      )
      expect(report.traits).toEqual([
        name("always-brace"),
        { source: TraitSourceId.make("effect"), ...name("always-brace") },
        name("concise-readme")
      ])
      const made = yield* requests
      const asserted = Array.filter(Array.flatten(made), ({ assertion }) => assertion !== undefined)
      expect(Array.map(asserted, ({ assertion }) => assertion)).toEqual([
        "Every if body has braces.",
        "Sourced assertion."
      ])

      const missing = TraitSelectionId.make("nightly")
      const error = yield* Effect.flip(
        TraitRun.run({ files: project, selections: [missing], threshold: 0.5 }).pipe(Effect.provide(layer))
      )
      expect(error).toEqual(TraitSelectionNotFoundError.make({ traitSelectionId: missing }))
    })
  )

  it.effect("runs the selection with the ID default when none is named, and fails when there is none", () =>
    Effect.gen(function* () {
      const files = { "a.ts": "if (x) { y() }" }
      const declared = yield* workspace({
        files,
        own: [braces, readme],
        selections: { ci: ["always-brace", "concise-readme"], default: ["concise-readme"] },
        answer
      })
      const report = yield* TraitRun.run({ files: declared.project, selections: [], threshold: 0.5 }).pipe(
        Effect.provide(declared.layer)
      )
      expect(report.traits).toEqual([name("concise-readme")])

      const undeclared = yield* workspace({
        files,
        own: [braces, readme],
        selections: { ci: ["always-brace"] },
        answer
      })
      const error = yield* Effect.flip(
        TraitRun.run({ files: undeclared.project, selections: [], threshold: 0.5 }).pipe(
          Effect.provide(undeclared.layer)
        )
      )
      expect(error).toEqual(TraitSelectionNotFoundError.make({ traitSelectionId: TraitSelectionId.make("default") }))
      const made = yield* undeclared.requests
      expect(made).toEqual([])
    })
  )

  it.effect("turns away a threshold that is not a probability before asking anything", () =>
    Effect.gen(function* () {
      const { layer, project, requests } = yield* workspace({ files: { "a.ts": "if (x) y()" }, own: [braces], answer })
      const error = yield* Effect.flip(
        TraitRun.run({ files: project, selections: [], threshold: 2 }).pipe(Effect.provide(layer))
      )
      expect(error._tag).toBe("SchemaError")
      const made = yield* requests
      expect(made).toEqual([])
    })
  )

  it.effect("asks about at most fifty traits in one request", () =>
    Effect.gen(function* () {
      const many = Array.makeBy(120, (index) =>
        trait({ name: `trait-${index}`, subject: "TypeScript if statements.", assertion: `Assertion ${index}.` })
      )
      const { layer, project, requests } = yield* workspace({ files: { "a.ts": "if (x) { y() }" }, own: many, answer })
      const report = yield* TraitRun.run({ files: project, selections: [], threshold: 0.5 }).pipe(Effect.provide(layer))
      expect(Array.map(report.files[0]?.checks ?? [], (check) => check.trait.name)).toEqual(
        Array.map(many, ({ name }) => name)
      )
      expect(TraitRun.tally(report)).toEqual({ NotApplicable: 0, Holds: 120, Violated: 0, NotAssessed: 0 })
      const made = yield* requests
      const sizes = (kind: "subject" | "assertion") =>
        pipe(
          made,
          Array.filter((questions) => questions[0]?.[kind] !== undefined),
          Array.map((questions) => questions.length),
          Array.sort((a: number, b: number) => (a < b ? 1 : a > b ? -1 : 0))
        )
      expect(sizes("subject")).toEqual([50, 50, 20])
      expect(sizes("assertion")).toEqual([50, 50, 20])
    })
  )

  it.effect("records what the model leaves unanswered, and a request that fails, without losing the rest", () =>
    Effect.gen(function* () {
      const { layer, project } = yield* workspace({
        files: { "a.ts": "if (x) { y() }", "b.ts": "if (x) { DOWN }" },
        own: [braces, readme],
        answer: (question) => (question.subject === "README files." ? undefined : answer(question)),
        fails: Array.some(({ assertion, target }) => assertion !== undefined && pipe(target, String.includes("DOWN")))
      })
      const report = yield* TraitRun.run({ files: project, selections: [], threshold: 0.5 }).pipe(Effect.provide(layer))
      const verdicts = Array.map(report.files, ({ checks, file }) => [
        file,
        Array.map(checks, ({ verdict }) => verdict)
      ])
      expect(verdicts).toEqual([
        ["a.ts", ["Holds", "NotAssessed"]],
        ["b.ts", ["NotAssessed", "NotAssessed"]]
      ])
      expect(report.files[0]?.checks[1]).toMatchObject({ applies: { _tag: "Unanswered", reason: "Missing" } })
      expect(report.files[1]?.checks[0]).toMatchObject({ holds: { _tag: "Unanswered", reason: "Failed" } })
      expect(TraitRun.tally(report)).toEqual({ NotApplicable: 0, Holds: 1, Violated: 0, NotAssessed: 3 })
    })
  )

  it.effect.each([
    [0.5, "Holds"],
    [0.49, "Violated"]
  ] as const)(
    "counts a probability of %d against a threshold of 0.5 as %s, and applies a trait at the threshold",
    ([probability, verdict]) =>
      Effect.gen(function* () {
        const { layer, project } = yield* workspace({
          files: { "a.ts": "if (x) { y() }" },
          own: [braces],
          answer: ({ subject }) => (subject === undefined ? probability : 0.5)
        })
        const report = yield* TraitRun.run({ files: project, selections: [], threshold: 0.5 }).pipe(
          Effect.provide(layer)
        )
        expect(report.files[0]?.checks[0]?.verdict).toBe(verdict)
      })
  )

  it.effect("checks each segment of a divided file on its own, and never the file as a whole", () =>
    Effect.gen(function* () {
      const text = "import x from 'x'\nif (a) b() // BAD\nif (c) { d() }\n"
      const { layer, project, requests } = yield* workspace({
        files: { "a.ts": text },
        own: [braces, readme],
        answer
      })
      const segmentation = Effect.succeed(() => [
        { start: 0, end: 17 },
        { start: 18, end: 35 },
        { start: 36, end: 50 }
      ])
      const report = yield* TraitRun.run({ files: project, segmentation, selections: [], threshold: 0.5 }).pipe(
        Effect.provide(layer)
      )
      const applies = { _tag: "Answered", probability: 0.9 }
      expect(report.files[0]?.checks).toEqual([
        {
          trait: name("always-brace"),
          lines: { start: 1, end: 1 },
          applies: { _tag: "Answered", probability: 0.1 },
          verdict: "NotApplicable"
        },
        {
          trait: name("always-brace"),
          lines: { start: 2, end: 2 },
          applies,
          holds: { _tag: "Answered", probability: 0.2 },
          verdict: "Violated"
        },
        {
          trait: name("always-brace"),
          lines: { start: 3, end: 3 },
          applies,
          holds: { _tag: "Answered", probability: 0.8 },
          verdict: "Holds"
        },
        ...Array.map([1, 2, 3], (line) => ({
          trait: name("concise-readme"),
          lines: { start: line, end: line },
          applies: { _tag: "Answered", probability: 0.1 },
          verdict: "NotApplicable"
        }))
      ])
      const made = yield* requests
      const asked = (subject: string) =>
        pipe(
          Array.flatten(made),
          Array.filter((question) => question.subject === subject),
          Array.map(({ target }) => target)
        )
      const segments = ["import x from 'x'", "if (a) b() // BAD", "if (c) { d() }"]
      expect(asked("README files.")).toEqual(segments)
      expect(asked("TypeScript if statements.")).toEqual(segments)
      const encoded = yield* S.encodeEffect(TraitRun.Report)(report)
      expect(TraitRun.format(encoded)).toContain("  violated      always-brace, line 2 (0.20)")
    })
  )

  it.effect.each([
    ["a single segment", (text: string) => [{ start: 0, end: text.length }]],
    [
      "ranges that reach past its text",
      (text: string) => [
        { start: 0, end: 4 },
        { start: 4, end: text.length + 9 }
      ]
    ],
    [
      "an empty range",
      () => [
        { start: 0, end: 4 },
        { start: 4, end: 4 }
      ]
    ]
  ] as const)("checks a file whole when it is divided into %s", ([, segment]) =>
    Effect.gen(function* () {
      const { layer, project } = yield* workspace({
        files: { "a.ts": "if (x) { y() }" },
        own: [braces],
        answer
      })
      const segmentation = Effect.succeed((_: string, text: string) => segment(text))
      const report = yield* TraitRun.run({ files: project, segmentation, selections: [], threshold: 0.5 }).pipe(
        Effect.provide(layer)
      )
      expect(report.files[0]?.checks).toEqual([
        {
          trait: name("always-brace"),
          applies: { _tag: "Answered", probability: 0.9 },
          holds: { _tag: "Answered", probability: 0.8 },
          verdict: "Holds"
        }
      ])
    })
  )

  it.effect("leaves a trait out of a file its match patterns leave out, without asking the model", () =>
    Effect.gen(function* () {
      const scripts = trait({
        name: "always-brace",
        subject: "TypeScript if statements.",
        match: "**/*.{ts,tsx}",
        assertion: "Every if body has braces."
      })
      const { layer, project, requests } = yield* workspace({
        files: { "src/a.ts": "if (x) { y() }", "notes.md": "Write if (x) y() in prose.", "b.tsx": "if (x) { y() }" },
        own: [scripts, readme],
        answer
      })
      const report = yield* TraitRun.run({ files: project, selections: [], threshold: 0.5 }).pipe(Effect.provide(layer))
      const checked = Array.map(report.files, ({ checks, file }) => [
        file,
        Array.map(checks, (check) => check.trait.name)
      ])
      expect(checked).toEqual([
        ["src/a.ts", ["always-brace", "concise-readme"]],
        ["notes.md", ["concise-readme"]],
        ["b.tsx", ["always-brace", "concise-readme"]]
      ])
      const made = yield* requests
      const asked = pipe(
        Array.flatten(made),
        Array.filter(({ subject }) => subject === "TypeScript if statements."),
        Array.map(({ target }) => target)
      )
      expect(asked).toEqual(["if (x) { y() }", "if (x) { y() }"])
    })
  )

  it.effect("checks a trait against a file that any one of its match patterns lets through", () =>
    Effect.gen(function* () {
      const scripts = trait({
        name: "always-brace",
        subject: "TypeScript if statements.",
        match: ["src/**/*.ts", "*.tsx"],
        assertion: "Every if body has braces."
      })
      const { layer, project } = yield* workspace({
        files: { "src/a.ts": "if (x) { y() }", "a.ts": "if (x) { y() }", "b.tsx": "if (x) { y() }" },
        own: [scripts],
        answer
      })
      const report = yield* TraitRun.run({ files: project, selections: [], threshold: 0.5 }).pipe(Effect.provide(layer))
      expect(Array.map(report.files, ({ checks, file }) => [file, checks.length])).toEqual([
        ["src/a.ts", 1],
        ["a.ts", 0],
        ["b.tsx", 1]
      ])
    })
  )

  it.effect("takes the answers it was given before from the store, and asks only about what has changed", () =>
    Effect.gen(function* () {
      const files: Record<string, string> = { "a.ts": "if (x) { y() }", "b.ts": "if (x) y() // BAD" }
      const { layer, project, requests } = yield* workspace({ files, own: [braces, readme], answer })
      const run = TraitRun.run({ files: project, selections: [], threshold: 0.5 }).pipe(Effect.provide(layer))

      const first = yield* run
      expect(first.usage).toEqual({ requests: 4, inputTokens: 40, outputTokens: 4, remembered: 0 })
      const again = yield* run
      expect(again.files).toEqual(first.files)
      // Two subjects and one assertion for each of the two files.
      expect(again.usage).toEqual({ requests: 0, inputTokens: 0, outputTokens: 0, remembered: 6 })
      const afterTwo = yield* requests
      expect(afterTwo).toHaveLength(4)

      files["b.ts"] = "if (x) { y() } // fixed"
      const changed = yield* run
      expect(changed.usage).toEqual({ requests: 2, inputTokens: 20, outputTokens: 2, remembered: 3 })
      expect(TraitRun.tally(changed)).toEqual({ NotApplicable: 2, Holds: 2, Violated: 0, NotAssessed: 0 })
      const afterThree = yield* requests
      expect(Array.map(Array.flatten(Array.drop(afterThree, 4)), ({ target }) => target)).toEqual([
        "if (x) { y() } // fixed",
        "if (x) { y() } // fixed",
        "if (x) { y() } // fixed"
      ])
    })
  )

  it.effect("asks again about what the model did not answer, since only answers are remembered", () =>
    Effect.gen(function* () {
      let down = true
      const { layer, project, requests } = yield* workspace({
        files: { "a.ts": "if (x) { y() }" },
        own: [braces],
        answer,
        fails: () => down
      })
      const run = TraitRun.run({ files: project, selections: [], threshold: 0.5 }).pipe(Effect.provide(layer))
      const failed = yield* run
      expect(TraitRun.tally(failed)).toEqual({ NotApplicable: 0, Holds: 0, Violated: 0, NotAssessed: 1 })
      down = false
      const recovered = yield* run
      expect(TraitRun.tally(recovered)).toEqual({ NotApplicable: 0, Holds: 1, Violated: 0, NotAssessed: 0 })
      expect(recovered.usage.remembered).toBe(0)
      const made = yield* requests
      expect(made).toHaveLength(3)
    })
  )

  it.effect("prints only what needs attention, then the totals", () =>
    Effect.gen(function* () {
      const { layer, project } = yield* workspace({
        files: { "src/a.ts": "if (x) y() // BAD", "src/b.ts": "if (x) { y() }", "logo.png": undefined },
        own: [braces, readme],
        answer: (question) => (question.subject === "README files." ? undefined : answer(question))
      })
      const report = yield* TraitRun.run({ files: project, selections: [], threshold: 0.5 }).pipe(Effect.provide(layer))
      const encoded = yield* S.encodeEffect(TraitRun.Report)(report)
      expect(TraitRun.format(encoded)).toBe(
        pipe(
          `
          |src/a.ts
          |  violated      always-brace (0.20)
          |  not assessed  concise-readme: Missing, The model gave no answer.
          |
          |src/b.ts
          |  not assessed  concise-readme: Missing, The model gave no answer.
          |
          |Files checked: 2, against 2 traits at a threshold of 0.5.
          |Checks: 1 violated, 2 not assessed, 1 held, 0 did not apply.
          |Files skipped for holding no text: 1.
          |Requests: 4. Tokens: 40 in, 4 out. Answers remembered from earlier runs: 0.
          `,
          String.stripMargin,
          String.trim
        )
      )
    })
  )

  describe("with a budget", () => {
    const files = { "a.ts": "if (x) { y() }", "b.ts": "if (x) y() // BAD", "README.md": "# Title" }

    it.effect("keeps a run within its token budget, leaving what does not fit unasked for a later run", () =>
      Effect.gen(function* () {
        const tokens = 1_000_000
        const { layer, project, requests } = yield* workspace({ files, own: [braces], answer, tokens })
        const options = { files: project, selections: [], threshold: 0.5 }

        // Not even the smallest request fits.
        const none = yield* TraitRun.run({ ...options, budget: { tokens: 1 } }).pipe(Effect.provide(layer))
        expect(none.usage.requests).toBe(0)
        expect(TraitRun.tally(none)).toEqual({ NotApplicable: 0, Holds: 0, Violated: 0, NotAssessed: 3 })
        expect(none.files[0]?.checks[0]?.applies).toEqual({
          _tag: "Unanswered",
          reason: "OverBudget",
          description: "It was not asked, to stay within the budget of 1 tokens."
        })
        const asked = yield* requests
        expect(asked).toEqual([])
        const encoded = yield* S.encodeEffect(TraitRun.Report)(none)
        expect(TraitRun.format(encoded)).toBe(
          pipe(
            `
            |Files checked: 3, against 1 traits at a threshold of 0.5.
            |Checks: 0 violated, 3 not assessed, 0 held, 0 did not apply.
            |Checks not asked, to stay within the budget: 3. Run again to carry on from here.
            |Requests: 0. Tokens: 0 in, 0 out. Answers remembered from earlier runs: 0.
            `,
            String.stripMargin,
            String.trim
          )
        )

        // What the first requests are reported to have used leaves no room for the rest, and their answers are kept.
        const some = yield* TraitRun.run({ ...options, budget: { tokens } }).pipe(Effect.provide(layer))
        expect(some.usage.requests).toBeGreaterThan(0)
        expect(some.usage.requests).toBeLessThan(5)
        expect(TraitRun.tally(some).NotAssessed).toBeGreaterThan(0)

        // A run with room carries on from what was kept.
        const all = yield* TraitRun.run(options).pipe(Effect.provide(layer))
        expect(TraitRun.tally(all)).toEqual({ NotApplicable: 1, Holds: 1, Violated: 1, NotAssessed: 0 })
        expect(all.usage.requests + some.usage.requests).toBe(5)
      })
    )

    it.effect("adds up what the provider says its requests cost, and keeps a run within a budget in dollars", () =>
      Effect.gen(function* () {
        const priced = yield* workspace({ files, own: [braces], answer, cost: 0.25 })
        const options = { files: priced.project, selections: [], threshold: 0.5 }
        const report = yield* TraitRun.run(options).pipe(Effect.provide(priced.layer))
        expect(report.usage).toMatchObject({ requests: 5, cost: 1.25 })
        const encoded = yield* S.encodeEffect(TraitRun.Report)(report)
        expect(TraitRun.format(encoded)).toContain("Requests: 5. Tokens: 50 in, 5 out. Cost: $1.25. Answers remembered")

        // What a token costs is only known once a request has been answered, so the first ones are let through.
        const limited = yield* workspace({ files, own: [braces], answer, cost: 0.25 })
        const within = yield* TraitRun.run({ ...options, files: limited.project, budget: { dollars: 0.3 } }).pipe(
          Effect.provide(limited.layer)
        )
        expect(within.usage.requests).toBeGreaterThan(0)
        expect(within.usage.requests).toBeLessThan(5)
        expect(TraitRun.tally(within).NotAssessed).toBeGreaterThan(0)

        // A provider that reports no cost gives a budget in dollars nothing to go by, so the run stops asking.
        const unpriced = yield* workspace({ files, own: [braces], answer })
        const blind = yield* TraitRun.run({ ...options, files: unpriced.project, budget: { dollars: 100 } }).pipe(
          Effect.provide(unpriced.layer)
        )
        expect(blind.usage.cost).toBeUndefined()
        expect(blind.usage.requests).toBeLessThan(5)
        const unasked = pipe(
          blind.files,
          Array.flatMap(({ checks }) => checks),
          Array.flatMap(({ applies, holds }) => {
            const last = holds ?? applies
            return last?._tag === "Unanswered" ? [last.description] : []
          })
        )
        expect(unasked).toContain(
          "It was not asked: the provider reports no cost for the budget of $100 to be kept by."
        )
      })
    )
  })
})
