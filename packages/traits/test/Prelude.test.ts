import { expect, it } from "@effect/vitest"
import { Array, Effect, pipe, Record, Ref, Schema as S, String } from "effect"

import * as Input from "../Input/Input.ts"
import { TraitPrelude } from "../Trait/TraitPrelude.ts"
import * as Prelude from "../TraitRun/Prelude.ts"
import * as TraitRun from "../TraitRun/TraitRun.ts"
import { half, name, trait, workspace } from "./_memoryWorkspace.ts"

const root = new URL("file:///workspace/")

const preludeOf = (encoded: unknown) => S.decodeUnknownEffect(TraitPrelude)(encoded)

/** An agent that reports which steps it was given and what it was shown, and records each task it carries out. */
const recordingAgent = Effect.gen(function* () {
  const tasks = yield* Ref.make<ReadonlyArray<Prelude.PreludeTask>>([])
  const agent: Prelude.PreludeAgentService = {
    carryOut: (task) =>
      Ref.update(tasks, Array.append(task)).pipe(
        Effect.as(`did ${Array.join(task.steps, "; ")} after ${Array.join(Record.keys(task.found), ",") || "nothing"}`)
      )
  }
  return { agent, tasks: Ref.get(tasks) }
})

const unused = trait({ name: "unused-exports", subject: "TypeScript modules.", assertion: "Every export is used." })

it.effect("carries out steps in order, each run of them as one task, and subagents under their labels", () =>
  Effect.gen(function* () {
    const prelude = yield* preludeOf([
      "find the exports",
      "list them",
      { callers: ["search for callers"], tests: ["search the tests", { fixtures: ["read the fixtures"] }] },
      "summarize"
    ])
    const { agent, tasks } = yield* recordingAgent
    const findings = yield* Prelude.carryOut({ trait: unused, prelude, file: "src/a.ts" }).pipe(
      Effect.provideService(Prelude.PreludeAgent, agent)
    )
    expect(findings.found).toEqual([
      "did find the exports; list them after nothing",
      "did summarize after steps-1,callers,tests,fixtures"
    ])
    expect(findings.subagents).toEqual({
      callers: "did search for callers after steps-1",
      tests: "did search the tests after steps-1",
      fixtures: "did read the fixtures after steps-1,steps-2"
    })
    expect((yield* tasks).length).toBe(5)
  })
)

it.effect(
  "checks a trait with a prelude against what the prelude found, and leaves it not assessed without an agent",
  () =>
    Effect.gen(function* () {
      const prelude = yield* preludeOf(["search the rest of the project for callers of each export"])
      const traits = [{ reference: name("unused-exports"), trait: trait({ ...unused, prelude }) }]
      const { layer, requests } = yield* workspace({
        files: {},
        own: [],
        answer: (question) =>
          question.subject !== undefined
            ? 0.9
            : question.prelude !== undefined && pipe(question.prelude, String.includes("no callers"))
              ? 0.1
              : 0.9
      })
      const input = yield* Input.select(
        "after",
        { uri: new URL("src/a.ts", root), text: "export const a = 1\n" },
        { start: 0, end: 19 }
      )

      const unprepared = yield* TraitRun.checkInput({ traits, input, root, threshold: half }).pipe(Effect.provide(layer))
      expect(unprepared.checks).toMatchObject([
        { verdict: "NotAssessed", holds: { _tag: "Unanswered", reason: "Failed" } }
      ])

      const agent: Prelude.PreludeAgentService = {
        carryOut: (task) => Effect.succeed(`${task.file}: a has no callers`)
      }
      const prepared = yield* TraitRun.checkInput({ traits, input, root, threshold: half }).pipe(
        Effect.provide(layer),
        Effect.provideService(Prelude.PreludeAgent, agent)
      )
      expect(prepared.checks).toMatchObject([{ verdict: "Violated" }])
      const requested = yield* requests
      const asked = Array.flatten(requested)
      expect(Array.filter(asked, ({ prelude }) => prelude !== undefined)).toMatchObject([
        {
          assertion: "Every export is used.",
          prelude: JSON.stringify({ found: ["src/a.ts: a has no callers"], subagents: {} })
        }
      ])
    })
)

it.effect("leaves a trait not assessed when the agent says what it found cannot settle the check", () =>
  Effect.gen(function* () {
    const prelude = yield* preludeOf(["count the rows the migration would change on staging"])
    const agent: Prelude.PreludeAgentService = {
      carryOut: () => Effect.succeed(`${Prelude.cannotCheck} staging has no rows for the migration to change.`)
    }
    const error = yield* Effect.flip(
      Prelude.carryOut({ trait: unused, prelude, file: "migrations/a.py" }).pipe(
        Effect.provideService(Prelude.PreludeAgent, agent)
      )
    )
    expect(error.reason).toBe("staging has no rows for the migration to change.")
  })
)

it.effect("checks a trait with a prelude against the whole file once, however the file is divided", () =>
  Effect.gen(function* () {
    const prelude = yield* preludeOf(["search the rest of the project for callers of each export"])
    const { layer, project } = yield* workspace({
      files: { "src/a.ts": "export const a = 1\nexport const b = 2\n" },
      own: [trait({ ...unused, prelude })],
      answer: () => 0.9
    })
    const { agent, tasks } = yield* recordingAgent
    const report = yield* TraitRun.run({
      files: project,
      segmentation: Effect.succeed((_, text) => [
        { start: 0, end: 18 },
        { start: 19, end: text.length }
      ]),
      selections: [],
      threshold: half
    }).pipe(Effect.provide(layer), Effect.provideService(Prelude.PreludeAgent, agent))
    const given = yield* tasks
    expect(given.length).toBe(1)
    expect(report.files[0]?.checks).toMatchObject([{ verdict: "Holds" }])
    expect(report.files[0]?.checks[0]?.lines).toBeUndefined()
  })
)
