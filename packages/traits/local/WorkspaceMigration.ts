import { Effect, FileSystem, pipe, Schema as S } from "effect"

import { AgentConfiguration } from "./AgentConfiguration.ts"
import * as CodingAgent from "./CodingAgent.ts"
import { ModelConfiguration } from "./ModelConfiguration.ts"
import { TraitsConfig } from "./TraitsConfig.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import * as WorkspaceModels from "./WorkspaceModels.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

/** Reads only agent/model settings: migration must work before the rest of the configuration is upgraded. */
export const run = Effect.fn("WorkspaceMigration.run")(function* (prompt: string) {
  const fs = yield* FileSystem.FileSystem
  const { directory } = yield* WorkspaceRoot
  const file = `${directory}/${WorkspaceLayout.config}`
  if (!(yield* fs.exists(file))) {
    return
  }
  const config = yield* fs.readFileString(file).pipe(
    Effect.flatMap(
      S.decodeEffect(
        S.fromJsonString(
          S.Struct({
            agent: AgentConfiguration.pipe(S.optionalKey),
            models: ModelConfiguration.pipe(S.optionalKey)
          })
        )
      )
    )
  )
  if (config.agent === undefined) {
    return
  }
  if (config.models === undefined) {
    return yield* CodingAgent.AgentError.make({
      message: "Configure models to classify and continue the migration agent's work.",
      session: "",
      stdout: []
    })
  }
  return yield* CodingAgent.run(config.agent, prompt).pipe(
    Effect.provide(
      pipe(
        { version: "internal" as const, models: config.models },
        (config) => TraitsConfig.make(config),
        WorkspaceModels.layerDecision
      )
    )
  )
})
