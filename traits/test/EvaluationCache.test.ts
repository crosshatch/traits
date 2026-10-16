import { layer } from "@effect/vitest"
import { Effect, FileSystem, Ref } from "effect"
import { expect } from "vite-plus/test"

import { cached } from "../EvaluationCache.ts"
import { Source, SourceLocation } from "../Source.ts"
import { Trait, TraitId, TraitName } from "../Trait.ts"
import { TraitEvaluation } from "../TraitEvaluation.ts"
import { services } from "./Services.ts"

const liveTests = layer(services, { excludeTestServices: true })

liveTests((it) => {
  it.effect("reuses identical pairs but invalidates changed chunks, locations and trait bodies", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "trait-assessments-" })
      const calls = yield* Ref.make(0)
      const trait = Trait.make({
        id: TraitId.make("2535ceab-5702-4ab4-932a-f87362adf8c6"),
        name: TraitName.make("arrow-functions"),
        body: "Use arrows"
      })
      const source = Source.make({
        text: "const f = () => 1",
        location: SourceLocation.cases.File.make({ path: "/project/a.ts", startLine: 1 })
      })
      const run = (currentTrait: Trait, currentSource: Source, context?: string) =>
        cached({
          directory,
          trait: currentTrait,
          source: currentSource,
          context,
          evaluate: Ref.update(calls, (count) => count + 1).pipe(
            Effect.as(
              TraitEvaluation.make({
                trait: currentTrait,
                source: currentSource,
                assessment: {
                  classification: "violation",
                  probabilities: { compliant: 0, violation: 1, "not-applicable": 0, inconclusive: 0 }
                }
              })
            )
          )
        })
      const first = yield* run(trait, source)
      const again = yield* run(trait, source)
      expect(again).toEqual(first)
      const reused = yield* Ref.get(calls)
      expect(reused).toBe(1)
      yield* run(Trait.make({ ...trait, body: "Use named arrows" }), source)
      yield* run(trait, Source.make({ ...source, text: "const f = () => 2" }))
      yield* run(
        trait,
        Source.make({ ...source, location: SourceLocation.cases.File.make({ path: "/project/a.ts", startLine: 201 }) })
      )
      const changed = yield* Ref.get(calls)
      expect(changed).toBe(4)
      for (const metadata of [{ mime: "text/typescript" }, { when: "editing functions" }, { skip: "generated code" }]) {
        yield* run(Trait.make({ ...trait, ...metadata }), source)
      }
      const rescoped = yield* Ref.get(calls)
      expect(rescoped).toBe(7)
      yield* run(trait, source, "different evaluator configuration")
      const reconfigured = yield* Ref.get(calls)
      expect(reconfigured).toBe(8)
      // Broken cache files must cause reassessment, not a false clean result.
      const files = yield* fs.readDirectory(directory)
      yield* Effect.forEach(files, (file) => fs.writeFileString(`${directory}/${file}`, "invalid JSON"))
      yield* run(trait, source)
      const recovered = yield* Ref.get(calls)
      expect(recovered).toBe(9)
    })
  )

  it.effect("does not cache inconclusive assessments or failed evaluations", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp/opencode", prefix: "trait-uncertain-" })
      const trait = Trait.make({
        id: TraitId.make("2535ceab-5702-4ab4-932a-f87362adf8c6"),
        name: TraitName.make("arrow-functions"),
        body: "Use arrows"
      })
      const source = Source.make({
        text: "f()",
        location: SourceLocation.cases.File.make({ path: "/project/a.ts", startLine: 1 })
      })
      yield* cached({
        directory,
        trait,
        source,
        evaluate: Effect.succeed(
          TraitEvaluation.make({
            trait,
            source,
            assessment: {
              classification: "inconclusive",
              probabilities: { compliant: 0, violation: 0, "not-applicable": 0, inconclusive: 1 }
            }
          })
        )
      })
      const failed = yield* cached({ directory, trait, source, evaluate: Effect.fail("model unavailable") }).pipe(
        Effect.flip
      )
      expect(failed).toBe("model unavailable")
      const files = yield* fs.readDirectory(directory)
      expect(files).toEqual([])
    })
  )
})
