import { Array, Effect, FileSystem } from "effect"
import { SecureRandom } from "effect/crypto"

import * as CodingAgent from "./CodingAgent.ts"
import * as TraitsConfig from "./TraitsConfig.ts"
import { WorkspaceCheck } from "./WorkspaceCheck.ts"
import * as WorkspaceModels from "./WorkspaceModels.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"
import type { TraitSelection } from "./WorkspaceTraits.ts"

/** Builds one report and a client-neutral application prompt without starting an agent. */
export const prepare = Effect.fn("WorkspaceApply.prepare")(function* (selection: TraitSelection = {}) {
  const fs = yield* FileSystem.FileSystem
  const { directory } = yield* WorkspaceRoot
  const random = yield* SecureRandom.SecureRandom
  yield* fs.makeDirectory(`${directory}/traits/stdout`, { recursive: true })
  if (!(yield* fs.exists(`${directory}/traits/stdout/.gitignore`))) {
    yield* fs.writeFileString(`${directory}/traits/stdout/.gitignore`, "*\n")
  }
  const checker = yield* WorkspaceCheck
  const { report } = yield* checker.check(selection)
  const traits = Array.map(report.traits, (entry) => entry.trait.name)
  const id = yield* random.uuidV4()
  const reportFile = `traits/stdout/${id}.report.json`
  yield* fs.writeFileString(`${directory}/${reportFile}`, JSON.stringify(report))
  const prompt = `Apply the ${traits.length} selected traits described in ${reportFile} to this project. Process its TraitReport entries generated from all project source files. Read source and trait definitions before editing. Ask the user when their input is needed, and let them review changes and decide when to commit.`
  return { traits, report, reportFile, prompt }
})

/** Independently retryable application; without an agent command, returns the prepared prompt to the calling client. */
export const run = Effect.fn("WorkspaceApply.run")(function* (selection: TraitSelection = {}) {
  const config = yield* TraitsConfig.load
  const prepared = yield* prepare(selection)
  if (config.agent === undefined || prepared.traits.length === 0) {
    return { ...prepared, execution: undefined }
  }
  const execution = yield* CodingAgent.run(config.agent, prepared.prompt).pipe(
    Effect.provide(WorkspaceModels.layerDecision(config))
  )
  return { ...prepared, execution }
})
