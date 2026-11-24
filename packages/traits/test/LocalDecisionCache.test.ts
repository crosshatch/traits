import { NodeServices } from "@effect/platform-node"
import { expect, layer } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Order, Path } from "effect"
import { TestConsole } from "effect/testing"

import * as LocalDecisionCache from "../local/LocalDecisionCache.ts"
import * as DecisionCache from "../TraitRun/DecisionCache.ts"
import { DecisionKey } from "../TraitRun/DecisionKey.ts"
import { QuestionId } from "../TraitRun/QuestionId.ts"
import { Probability } from "../util/Probability.ts"
import { git, localPaths } from "./_localWorkspace.ts"

const key = DecisionKey.make("key")
const answers = { [QuestionId.make("question")]: Probability.make(0.9) }
const decision = { provider: "openai", model: "org/decision" }

/** Remembers answers through a cache of the workspace with this traits directory, built anew, as each run builds it. */
const remember = (traits: string, added: DecisionCache.Answers, cache = LocalDecisionCache.layer(decision)) =>
  DecisionCache.DecisionCache.use((kept) => kept.remember(key, added)).pipe(
    Effect.provide(cache.pipe(Layer.provide(localPaths(traits))))
  )

/** What a cache of the workspace with this traits directory remembers, built anew, so only what was kept is there. */
const recall = (traits: string, cache = LocalDecisionCache.layer(decision)) =>
  DecisionCache.DecisionCache.use((kept) => kept.recall(key)).pipe(
    Effect.provide(cache.pipe(Layer.provide(localPaths(traits))))
  )

layer(NodeServices.layer)((it) => {
  it.effect("keeps each model's answers in a directory of its own, under a traits/.cache that ignores itself", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* fs.makeTempDirectoryScoped()
      const traits = path.join(root, "traits")
      yield* fs.makeDirectory(traits)

      yield* remember(traits, answers)
      const kept = yield* recall(traits)
      expect(kept).toEqual(answers)
      const another = yield* recall(traits, LocalDecisionCache.layer({ provider: "openai", model: "another" }))
      expect(another).toEqual({})
      const ignore = yield* fs.readFileString(path.join(traits, ".cache", ".gitignore"))
      expect(ignore).toBe("*\n")
      const models = yield* fs.readDirectory(path.join(traits, ".cache", "decisions"))
      expect(Array.sort(models, Order.String)).toEqual(["openai%2Fanother", "openai%2Forg%2Fdecision"])
    })
  )

  it.effect("reads what is already remembered without adding to it or creating anything, for what only reads", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* fs.makeTempDirectoryScoped()
      const traits = path.join(root, "traits")
      yield* fs.makeDirectory(traits)
      const existing = LocalDecisionCache.layerExisting(decision)

      yield* remember(traits, answers, existing)
      const nothing = yield* recall(traits, existing)
      expect(nothing).toEqual({})
      const created = yield* fs.exists(path.join(traits, ".cache"))
      expect(created).toBe(false)

      yield* remember(traits, answers)
      yield* remember(traits, { [QuestionId.make("another")]: Probability.make(0.1) }, existing)
      const kept = yield* recall(traits, existing)
      expect(kept).toEqual(answers)
    })
  )

  it.effect("recalls in a worktree what the checkout it was added from remembers, and keeps what it is told", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const directory = yield* Effect.flatMap(fs.makeTempDirectoryScoped(), fs.realPath)
      const main = path.join(directory, "main", "traits")
      const linked = path.join(directory, "linked", "traits")
      yield* fs.makeDirectory(main, { recursive: true })
      yield* fs.writeFileString(path.join(main, "config.json"), "{}")
      yield* git(path.dirname(main), "init", "--quiet", "--initial-branch", "main")
      yield* git(path.dirname(main), "add", "--all")
      yield* git(path.dirname(main), "commit", "--quiet", "--message", "first")
      yield* git(path.dirname(main), "worktree", "add", "--quiet", path.dirname(linked))

      yield* remember(main, answers)
      const started = yield* recall(linked)
      expect(started).toEqual(answers)
      const read = yield* recall(linked, LocalDecisionCache.layerExisting(decision))
      expect(read).toEqual(answers)

      // Its own answer to a question takes the place of that checkout's, which is left as it was.
      const told = {
        [QuestionId.make("question")]: Probability.make(0.2),
        [QuestionId.make("another")]: Probability.make(0.1)
      }
      yield* remember(linked, told)
      const kept = yield* recall(linked)
      expect(kept).toEqual(told)
      const untouched = yield* recall(main)
      expect(untouched).toEqual(answers)
    })
  )

  it.effect("says so when the cache cannot be made, and carries on with nothing remembered", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* fs.makeTempDirectoryScoped()
      const traits = path.join(root, "traits")
      yield* fs.makeDirectory(traits)
      // A file is where the cache's directory belongs.
      yield* fs.writeFileString(path.join(traits, ".cache"), "in the way")

      yield* remember(traits, answers)
      const remembered = yield* recall(traits)
      expect(remembered).toEqual({})
      const logged = yield* TestConsole.logLines
      expect(logged).toContainEqual(
        expect.stringContaining("What the model answers cannot be kept, so it is asked again next time: ")
      )
      const untouched = yield* fs.readFileString(path.join(traits, ".cache"))
      expect(untouched).toBe("in the way")
    })
  )
})
