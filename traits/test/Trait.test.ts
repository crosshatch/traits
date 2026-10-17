import { expect, it } from "@effect/vitest"
import { Array, Effect, Layer, pipe, Result, Schema as S, Semaphore, Stream, String } from "effect"
import { DecisionModel, LanguageModel } from "effect/ai"
import { toCodecOpenAI } from "effect/ai/OpenAiStructuredOutput"

import * as Trait from "../Trait.ts"
import { TraitsContext } from "../TraitsContext.ts"

const name = Trait.TraitName.make("test-trait")

it.effect(
  "requests the distinct JSON shape required for decomposition",
  Effect.fnUntraced(function* () {
    const bodies = ["Use two spaces for indentation.", "Use single quotes."]
    const requests: Array<LanguageModel.ProviderOptions> = []
    const decisionModel = yield* DecisionModel.make({
      decide: () =>
        Effect.succeed({
          answers: {
            assessment: { _tag: "Classify", label: "decomposable", probabilities: { atomic: 0, decomposable: 1 } }
          },
          usage: { inputTokens: 0, outputTokens: 0 }
        })
    })
    const languageModel = yield* LanguageModel.make({
      generateText: (request) => {
        requests.push(request)
        return Effect.succeed([{ type: "text", text: JSON.stringify({ traits: bodies }) }])
      },
      streamText: () => Stream.empty,
      codecTransformer: toCodecOpenAI
    })
    const semaphore = yield* Semaphore.make(1)
    const layerDecisionModel = Layer.succeed(DecisionModel.DecisionModel, decisionModel)
    const layerLanguageModel = Layer.succeed(LanguageModel.LanguageModel, languageModel)
    const result = yield* Trait.checkDecomposability(Array.join(bodies, " ")).pipe(
      Effect.provide(
        Layer.mergeAll(
          layerDecisionModel,
          layerLanguageModel,
          Layer.succeed(TraitsContext, {
            configRoot: "/test",
            excludes: [],
            semaphore,
            config: {
              decisionConcurrency: 1,
              excludeGitignored: true,
              excludes: [],
              layerDecisionModel,
              layerLanguageModel
            }
          })
        )
      )
    )
    expect(result).toEqual(bodies)
    expect(requests[0]?.prompt.content[0]).toMatchObject({
      role: "system",
      content: expect.stringContaining('Return only a JSON object with this shape: {"traits":["')
    })
  })
)

it.effect(
  "roundtrips a dedicated BAD-to-GOOD diff separately from metadata and body",
  Effect.fnUntraced(function* () {
    const diff = "-const value = bad()\n+const value = good()"
    const body = "Prefer good().\n\n---\nKeep this separator.\n"
    const trait = Trait.Trait.make({ name, diff, body, applicability: {}, extensionMetadata: { priority: 2 } })
    const text = Trait.serialize(trait)
    expect(text).toContain(`---\n\n\`\`\`diff\n${diff}\n\`\`\`\n\n---\n${body}`)
    expect(text).not.toContain("diff:")
    const parsed = yield* Trait.parse(text, "/traits/test.md")
    expect(parsed).toEqual(trait)
    const crlf = yield* Trait.parse(pipe(text, String.replaceAll("\n", "\r\n")), "/traits/test.md")
    expect(crlf.diff).toBe(pipe(diff, String.replaceAll("\n", "\r\n")))
    expect(crlf.body).toBe(pipe(body, String.replaceAll("\n", "\r\n")))
  })
)

it.effect(
  "rejects incomplete leading examples and examples without both sides",
  Effect.fnUntraced(function* () {
    for (const example of [
      "```diff\n-bad()\n+good()\n```\nBody",
      "```diff\n+good()\n```\n\n---\nBody",
      "```diff\n-bad()\n"
    ]) {
      const result = yield* Trait.parse(`---\nname: ${name}\n---\n${example}`, "/traits/test.md").pipe(Effect.result)
      expect(Result.isFailure(result)).toBe(true)
    }
  })
)

it.effect(
  "loads frontmatter without changing the Markdown body",
  Effect.fnUntraced(function* () {
    const body = "Keep this body.\n\n---\nNot a header.\n"
    const trait = yield* Trait.parse(`---\nname: ${name}\n---\n${body}`, "/traits/test.md")
    expect(trait).toEqual({ name, body, applicability: {}, extensionMetadata: {} })
    expect(Trait.serialize(trait)).toBe(`---\nname: ${name}\n---\n${body}`)
  })
)

it.effect(
  "parses YAML metadata separately from the body and preserves additional fields",
  Effect.fnUntraced(function* () {
    const trait = yield* Trait.parse(
      `---\nname: ${name}\nwhen: editing schemas.\nmime:\n  - text/typescript\npriority: 2\n---\nBody.\n`,
      "/traits/test.md"
    )
    expect(trait).toEqual({
      name,
      body: "Body.\n",
      applicability: { when: "editing schemas.", mime: ["text/typescript"] },
      extensionMetadata: { priority: 2 }
    })
    const roundtrip = yield* Trait.parse(Trait.serialize(trait), "/traits/test.md")
    expect(roundtrip).toEqual(trait)
    expect(Trait.serialize(trait)).toContain("when: editing schemas.")
    expect(Trait.serialize(trait)).not.toContain("activation:")
  })
)

it.effect(
  "supports scalar MIME values, multiline when, and CRLF headers",
  Effect.fnUntraced(function* () {
    const trait = yield* Trait.parse(
      `---\r\nname: ${name}\r\nwhen: |\r\n  editing\r\n  React components.\r\nmime: text/tsx\r\n---\r\nBody.\r\n`,
      "/traits/test.md"
    )
    expect(trait.applicability.when).toBe("editing\nReact components.\n")
    expect(trait.applicability.mime).toBe("text/tsx")
    expect(trait.body).toBe("Body.\r\n")
  })
)

it.effect(
  "supports minimal frontmatter and a closing delimiter at end of file",
  Effect.fnUntraced(function* () {
    const empty = yield* Trait.parse(`---\nname: ${name}\n---\nBody`, "/traits/test.md")
    expect(empty).toEqual({ name, body: "Body", applicability: {}, extensionMetadata: {} })
    const atEnd = yield* Trait.parse(`---\nname: ${name}\nmime: text/typescript\n---`, "/traits/test.md")
    expect(atEnd).toEqual({
      name,
      body: "",
      applicability: { mime: "text/typescript" },
      extensionMetadata: {}
    })
  })
)

it.effect(
  "rejects malformed, unterminated, and incorrectly typed metadata",
  Effect.fnUntraced(function* () {
    for (const text of [
      "---\nmime: [\n---\nBody",
      "---\nmime: text/typescript\nBody",
      "---\n- not an object\n---\nBody",
      `---\nname: ${name}\nwhen: false\n---\nBody`,
      `---\nname: ${name}\nmime: 123\n---\nBody`,
      "---\nname: invalid_name\n---\nBody",
      "---\nwhen: Missing name\n---\nBody",
      "Body without frontmatter",
      `Body before frontmatter\n---\nname: ${name}\n---\nBody`
    ]) {
      const result = yield* Trait.parse(text, "/traits/test.md").pipe(Effect.result)
      expect(Result.isFailure(result)).toBe(true)
    }
  })
)

it.effect(
  "serializes updated bodies without dropping metadata",
  Effect.fnUntraced(function* () {
    const trait = Trait.Trait.make({
      name,
      body: "Replacement\n",
      applicability: { when: "editing.", mime: "text/tsx" },
      extensionMetadata: {}
    })
    const roundtrip = yield* Trait.parse(Trait.serialize(trait), "/traits/test.md")
    expect(roundtrip).toEqual(trait)
  })
)

it.effect(
  "preserves skip conditions alongside when without changing the body",
  Effect.fnUntraced(function* () {
    const trait = yield* Trait.parse(
      `---\nname: ${name}\nwhen: editing React state.\nskip: When a custom registry is required.\n---\nBody`,
      "/traits/test.md"
    )
    expect(trait.applicability.skip).toBe("When a custom registry is required.")
    expect(trait.applicability.when).toBe("editing React state.")
    expect(trait.body).toBe("Body")
    const roundtrip = yield* Trait.parse(Trait.serialize(trait), "/traits/test.md")
    expect(roundtrip).toEqual(trait)
  })
)

it.effect(
  "rejects non-string skip conditions",
  Effect.fnUntraced(function* () {
    const result = yield* Trait.parse(`---\nname: ${name}\nskip: true\n---\nBody`, "/traits/test.md").pipe(
      Effect.result
    )
    expect(Result.isFailure(result)).toBe(true)
  })
)

it.effect(
  "preserves frontmatter identity while keeping the Markdown body authoritative",
  Effect.fnUntraced(function* () {
    const trait = yield* Trait.parse(
      `---\nname: ${name}\nbody: Other body\nmime: text/typescript\n---\nBody`,
      "/traits/test.md"
    )
    expect(trait).toEqual({ name, body: "Body", applicability: { mime: "text/typescript" }, extensionMetadata: {} })
    expect(Trait.serialize(trait)).toBe(`---\nmime: text/typescript\nname: ${name}\n---\nBody`)
  })
)

it.effect(
  "requires a safe descriptive name",
  Effect.fnUntraced(function* () {
    for (const invalid of [
      "",
      "../escape",
      "with/slash",
      "name.md",
      "Uppercase",
      "two words",
      "snake_case",
      "trait-example",
      pipe("a", String.repeat(81))
    ]) {
      const result = yield* Trait.parse(`---\nname: ${JSON.stringify(invalid)}\n---\nBody`, "/traits/test.md").pipe(
        Effect.result
      )
      expect(Result.isFailure(result)).toBe(true)
    }
    const missing = yield* Trait.parse("---\nmime: text/typescript\n---\nBody", "/traits/test.md").pipe(Effect.result)
    expect(Result.isFailure(missing)).toBe(true)
  })
)

it.effect(
  "roundtrips nested JSON-compatible extension metadata",
  Effect.fnUntraced(function* () {
    const trait = Trait.Trait.make({
      name,
      body: "Body",
      applicability: {},
      extensionMetadata: { metadata: { values: [null, true, 2, "text", { nested: false }] } }
    })
    const roundtrip = yield* Trait.parse(Trait.serialize(trait), "/traits/test.md")
    expect(roundtrip).toEqual(trait)
  })
)

it.effect(
  "rejects non-JSON extension values in frontmatter and domain records",
  Effect.fnUntraced(function* () {
    for (const value of [".nan", ".inf", "-.inf", "{ nested: [.nan] }"]) {
      const result = yield* Trait.parse(`---\nname: ${name}\nmetadata: ${value}\n---\nBody`, "/traits/test.md").pipe(
        Effect.result
      )
      expect(Result.isFailure(result)).toBe(true)
    }
    for (const metadata of [undefined, NaN, Infinity, { nested: [undefined] }]) {
      const result = yield* pipe(
        { name, body: "Body", applicability: {}, extensionMetadata: { metadata } },
        S.decodeUnknownEffect(Trait.Trait),
        Effect.result
      )
      expect(Result.isFailure(result)).toBe(true)
    }
  })
)
