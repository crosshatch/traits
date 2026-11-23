import { expect, it } from "@effect/vitest"
import { Effect, Result, Schema as S } from "effect"

import { TraitName } from "../Trait/TraitName.ts"
import { TraitSourceId } from "../TraitCollection/TraitSourceId.ts"
import { TraitReference } from "../TraitSelection/TraitReference.ts"

const own = { name: TraitName.make("my-trait") }
const sourced = { source: TraitSourceId.make("effect"), name: TraitName.make("my-trait") }

it.effect("is written as the path of the trait's file under traits/, without the extension", () =>
  Effect.gen(function* () {
    const fromOwn = yield* S.decodeEffect(TraitReference)("my-trait")
    const fromSourced = yield* S.decodeEffect(TraitReference)("effect/my-trait")
    expect([fromOwn, fromSourced]).toEqual([own, sourced])
    const toOwn = yield* S.encodeEffect(TraitReference)(own)
    const toSourced = yield* S.encodeEffect(TraitReference)(sourced)
    expect([toOwn, toSourced]).toEqual(["my-trait", "effect/my-trait"])
  })
)

it.each([
  ["a path with more than one directory", "a/b/c", 'at ["name"]'],
  ["a missing source", "/my-trait", 'at ["source"]'],
  ["a missing name", "effect/", 'at ["name"]'],
  ["a source that is not kebab-case", "Effect/my-trait", 'at ["source"]'],
  ["a name that is not kebab-case", "my trait", 'at ["name"]'],
  ["a file name with its extension", "my-trait.md", 'at ["name"]'],
  ["an object", { name: "my-trait" }, "Expected string"]
])("rejects %s", (_name, reference, message) => {
  const result = S.decodeUnknownResult(TraitReference)(reference)
  expect(Result.isFailure(result) ? result.failure.message : undefined).toContain(message)
})
