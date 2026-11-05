import { expect, it } from "@effect/vitest"
import { Effect, pipe, Result, Schema as S, String } from "effect"

import * as ModuleSpecifier from "../ModuleSpecifier.ts"
import { Trait } from "../Trait.ts"

it.effect("applies file-module policy to trusted resolver output", () =>
  Effect.gen(function* () {
    for (const reference of [
      "node:fs",
      "data:text/javascript,export default 1",
      "file:///module.mjs?copy",
      "file:///module.mjs#copy",
      "file:///module.mjs?",
      "file:///module.mjs#"
    ]) {
      const input = { reference, baseUrl: new URL(import.meta.url) }
      const result = yield* ModuleSpecifier.resolve(input).pipe(Effect.result)
      expect(Result.isFailure(result)).toBe(true)
      if (Result.isFailure(result)) {
        expect(result.failure.input).toEqual(input)
        expect(S.isSchemaError(result.failure.cause)).toBe(true)
      }
    }
  })
)

it.effect("rejects unresolved extension identities and non-file or cache-busting URLs", () =>
  Effect.gen(function* () {
    for (const reference of [
      "./local.ts",
      "../local.ts",
      "@traits/typescript/segmenter",
      "/absolute.ts",
      "node:fs",
      "data:text/javascript,export default 1",
      "file:///module.mjs?copy",
      "file:///module.mjs#copy",
      "file:///module.mjs?",
      "file:///module.mjs#",
      "file://localhost:123/module.mjs"
    ]) {
      const result = yield* pipe(reference, S.decodeEffect(ModuleSpecifier.ModuleSpecifier), Effect.result)
      expect(Result.isFailure(result)).toBe(true)
    }
    yield* pipe("file:///consumer/module.mjs", S.decodeEffect(ModuleSpecifier.ModuleSpecifier))
    const unresolvedTrait = yield* pipe(
      { name: "example", purpose: "Protect correctness.", segment: "./segmenter.mjs" },
      S.decodeEffect(Trait),
      Effect.result
    )
    expect(Result.isFailure(unresolvedTrait)).toBe(true)
  })
)

it.effect("normalizes file URL syntax without imposing a pathname length limit", () =>
  Effect.gen(function* () {
    const module = yield* pipe(
      "file:///consumer/nested/../module%3Fname.mjs",
      S.decodeEffect(ModuleSpecifier.ModuleSpecifier)
    )
    expect(module).toBe("file:///consumer/module%3Fname.mjs")
    const encoded = yield* pipe(module, S.encodeEffect(ModuleSpecifier.ModuleSpecifier))
    expect(encoded).toBe(module)
    const longUrl = `file:///consumer/${pipe("a/", String.repeat(1_100))}module.mjs`
    const longModule = yield* pipe(longUrl, S.decodeEffect(ModuleSpecifier.ModuleSpecifier))
    expect(longModule).toBe(longUrl)
  })
)
