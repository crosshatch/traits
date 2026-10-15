import { NodeCrypto } from "@effect/platform-node"
import { expect, it } from "@effect/vitest"
import { Effect, pipe, Result, Schema as S, String } from "effect"

import * as Trait from "../Trait.ts"

const name = Trait.TraitName.make("test_trait")
const id = Trait.TraitId.make("2535ceab-5702-4ab4-932a-f87362adf8c6")

it.effect(
  "returns a domain error for missing frontmatter",
  Effect.fnUntraced(function* () {
    const result = yield* Trait.parse("Body").pipe(Effect.result)
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(Trait.TraitParseError)
      expect(result.failure).toMatchObject({ reason: "MissingFrontmatter" })
    }
  })
)

it.effect(
  "preserves the YAML parser cause in a domain error",
  Effect.fnUntraced(function* () {
    const result = yield* Trait.parse("---\nname: [\n---\nBody").pipe(Effect.result)
    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(Trait.TraitParseError)
      expect(result.failure).toMatchObject({ reason: "InvalidYaml", cause: expect.any(Error) })
    }
  })
)

it.effect(
  "loads frontmatter without changing the Markdown body",
  Effect.fnUntraced(function* () {
    const body = "Keep this body.\n\n---\nNot a header.\n"
    const trait = yield* Trait.parse(`---\nid: ${id}\nname: ${name}\n---\n${body}`)
    expect(trait).toEqual({ id, name, body })
    expect(Trait.serialize(trait)).toBe(`---\nid: ${id}\nname: ${name}\n---\n${body}`)
  })
)

it.effect(
  "parses YAML metadata separately from the body and preserves additional fields",
  Effect.fnUntraced(function* () {
    const trait = yield* Trait.parse(
      `---\nid: ${id}\nname: ${name}\nactivation: When editing schemas.\nmime:\n  - text/typescript\npriority: 2\n---\nBody.\n`
    )
    expect(trait).toEqual({
      name,
      id,
      body: "Body.\n",
      activation: "When editing schemas.",
      mime: ["text/typescript"],
      priority: 2
    })
    const roundtrip = yield* Trait.parse(Trait.serialize(trait))
    expect(roundtrip).toEqual(trait)
  })
)

it.effect(
  "supports scalar MIME values, multiline activation, and CRLF headers",
  Effect.fnUntraced(function* () {
    const trait = yield* Trait.parse(
      `---\r\nid: ${id}\r\nname: ${name}\r\nactivation: |\r\n  When editing\r\n  React components.\r\nmime: text/tsx\r\n---\r\nBody.\r\n`
    )
    expect(trait.activation).toBe("When editing\nReact components.\n")
    expect(trait.mime).toBe("text/tsx")
    expect(trait.body).toBe("Body.\r\n")
  })
)

it.effect(
  "supports minimal frontmatter and a closing delimiter at end of file",
  Effect.fnUntraced(function* () {
    const empty = yield* Trait.parse(`---\nid: ${id}\nname: ${name}\n---\nBody`)
    expect(empty).toEqual({ id, name, body: "Body" })
    const atEnd = yield* Trait.parse(`---\nid: ${id}\nname: ${name}\nmime: text/typescript\n---`)
    expect(atEnd).toEqual({
      name,
      id,
      body: "",
      mime: "text/typescript"
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
      `---\nid: ${id}\nname: ${name}\nactivation: false\n---\nBody`,
      `---\nid: ${id}\nname: ${name}\nmime: 123\n---\nBody`,
      `---\nid: invalid\nname: ${name}\n---\nBody`,
      `---\nname: ${name}\n---\nBody`,
      "---\nname: invalid-name\n---\nBody",
      "---\nactivation: Missing name\n---\nBody",
      "Body without frontmatter",
      `Body before frontmatter\n---\nname: ${name}\n---\nBody`
    ]) {
      const result = yield* Trait.parse(text).pipe(Effect.result)
      expect(Result.isFailure(result)).toBe(true)
    }
  })
)

it.effect(
  "serializes updated bodies without dropping metadata",
  Effect.fnUntraced(function* () {
    const trait = Trait.Trait.make({
      id,
      name,
      body: "Replacement\n",
      activation: "When editing.",
      mime: "text/tsx"
    })
    const roundtrip = yield* Trait.parse(Trait.serialize(trait))
    expect(roundtrip).toEqual(trait)
  })
)

it.effect(
  "preserves skip conditions alongside activation without changing the body",
  Effect.fnUntraced(function* () {
    const trait = yield* Trait.parse(
      `---\nid: ${id}\nname: ${name}\nactivation: When editing React state.\nskip: When a custom registry is required.\n---\nBody`
    )
    expect(trait.skip).toBe("When a custom registry is required.")
    expect(trait.activation).toBe("When editing React state.")
    expect(trait.body).toBe("Body")
    const roundtrip = yield* Trait.parse(Trait.serialize(trait))
    expect(roundtrip).toEqual(trait)
  })
)

it.effect(
  "rejects non-string skip conditions",
  Effect.fnUntraced(function* () {
    const result = yield* Trait.parse(`---\nid: ${id}\nname: ${name}\nskip: true\n---\nBody`).pipe(Effect.result)
    expect(Result.isFailure(result)).toBe(true)
  })
)

it.effect(
  "preserves frontmatter identity while keeping the Markdown body authoritative",
  Effect.fnUntraced(function* () {
    const trait = yield* Trait.parse(
      `---\nid: ${id}\nname: ${name}\nbody: Other body\nmime: text/typescript\n---\nBody`
    )
    expect(trait).toEqual({ id, name, body: "Body", mime: "text/typescript" })
    expect(Trait.serialize(trait)).toBe(`---\nid: ${id}\nname: ${name}\nmime: text/typescript\n---\nBody`)
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
      "kebab-case",
      pipe("a", String.repeat(81))
    ]) {
      const result = yield* Trait.parse(`---\nid: ${id}\nname: ${JSON.stringify(invalid)}\n---\nBody`).pipe(
        Effect.result
      )
      expect(Result.isFailure(result)).toBe(true)
    }
    const missing = yield* Trait.parse(`---\nid: ${id}\n---\nBody`).pipe(Effect.result)
    expect(Result.isFailure(missing)).toBe(true)
  })
)

it.effect(
  "roundtrips nested JSON-compatible extension metadata",
  Effect.fnUntraced(function* () {
    const trait = Trait.Trait.make({
      id,
      name,
      body: "Body",
      metadata: { values: [null, true, 2, "text", { nested: false }] }
    })
    const roundtrip = yield* Trait.parse(Trait.serialize(trait))
    expect(roundtrip).toEqual(trait)
  })
)

it.effect(
  "rejects non-JSON extension values in frontmatter and domain records",
  Effect.fnUntraced(function* () {
    for (const value of [".nan", ".inf", "-.inf", "{ nested: [.nan] }"]) {
      const result = yield* Trait.parse(`---\nid: ${id}\nname: ${name}\nmetadata: ${value}\n---\nBody`).pipe(
        Effect.result
      )
      expect(Result.isFailure(result)).toBe(true)
    }
    for (const metadata of [undefined, NaN, Infinity, { nested: [undefined] }]) {
      const result = yield* pipe(
        { id, name, body: "Body", metadata },
        S.decodeUnknownEffect(Trait.Trait),
        Effect.result
      )
      expect(Result.isFailure(result)).toBe(true)
    }
  })
)

it.effect(
  "creates crypto UUIDs outside storage while preserving all draft fields",
  Effect.fn("test.Trait.make")(function* () {
    const draft = { name, body: "Body", activation: "When testing.", mime: ["text/typescript"], priority: 2 }
    const first = yield* Trait.make(draft)
    const second = yield* Trait.make(draft)
    expect(first).toMatchObject(draft)
    expect(second).toMatchObject(draft)
    expect(first.id).not.toBe(second.id)
    expect(first.id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  }, Effect.provide(NodeCrypto.layer))
)
