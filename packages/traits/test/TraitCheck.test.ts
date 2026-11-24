import { expect, it } from "@effect/vitest"
import { Array, Effect } from "effect"

import * as Input from "../Input/Input.ts"
import * as TraitRun from "../TraitRun/TraitRun.ts"
import { answer, braces, name, readme, workspace } from "./_memoryWorkspace.ts"

const root = new URL("file:///workspace/")
const traits = [
  { reference: name("always-brace"), trait: braces },
  { reference: name("concise-readme"), trait: readme }
]

it.effect("checks one input against the traits it is given, asking only about the text the input selects", () =>
  Effect.gen(function* () {
    const { layer, requests } = yield* workspace({ files: {}, own: [], answer })
    const input = yield* Input.select(
      "after",
      { uri: new URL("src/a.ts", root), text: "const x = 1\nif (x) y() // BAD\n" },
      { start: 12, end: 29 }
    )
    const { checks, usage } = yield* TraitRun.checkInput({ traits, input, root, threshold: 0.5 }).pipe(
      Effect.provide(layer)
    )
    expect(checks).toEqual([
      {
        trait: name("always-brace"),
        applies: { _tag: "Answered", probability: 0.9 },
        holds: { _tag: "Answered", probability: 0.2 },
        verdict: "Violated"
      },
      { trait: name("concise-readme"), applies: { _tag: "Answered", probability: 0.1 }, verdict: "NotApplicable" }
    ])
    expect(usage).toMatchObject({ requests: 2, remembered: 0 })
    const asked = yield* requests
    expect(Array.dedupe(Array.map(Array.flatten(asked), ({ target }) => target))).toEqual(["if (x) y() // BAD"])

    const error = yield* Effect.flip(
      TraitRun.checkInput({ traits, input, root, threshold: -0.5 }).pipe(Effect.provide(layer))
    )
    expect(error._tag).toBe("SchemaError")
  })
)
