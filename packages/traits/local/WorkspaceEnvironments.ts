import { Array, Effect, FileSystem, Order, Path, pipe, Schema as S, String } from "effect"

import type { EnvironmentName } from "../EnvironmentName.ts"
import { TraitsEnvironment } from "../TraitsEnvironment.ts"
import * as WorkspaceLayout from "./WorkspaceLayout.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

/** An environment file is missing, unreadable, or invalid. */
export class EnvironmentError extends S.TaggedError<EnvironmentError>()("EnvironmentError", {
  environment: S.String.annotateKey({ description: "The environment name." }),
  problem: S.String.annotateKey({ description: "What is wrong with the environment." })
}) {
  override get message(): string {
    return `Cannot use environment "${this.environment}": ${this.problem}`
  }
}

/** Loads a named environment from traits/_environments. */
export const load = Effect.fn("WorkspaceEnvironments.load")(function* (name: EnvironmentName) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { directory } = yield* WorkspaceRoot
  const file = WorkspaceLayout.environmentFile(name)
  const text = yield* fs.readFileString(path.join(directory, file)).pipe(
    Effect.catchReason("PlatformError", "NotFound", () =>
      Effect.gen(function* () {
        const available = yield* fs.readDirectory(path.join(directory, WorkspaceLayout.environments)).pipe(
          Effect.map(
            Array.flatMap((entry) => (String.endsWith(".json")(entry) ? [String.slice(0, -".json".length)(entry)] : []))
          ),
          Effect.orElseSucceed((): ReadonlyArray<string> => [])
        )
        return yield* EnvironmentError.make({
          environment: name,
          problem: `${file} does not exist. ${available.length === 0 ? "No environments are defined" : `Available environments: ${pipe(Array.sort(available, Order.String), Array.join(", "))}`}; omit the environment to check every trait.`
        })
      })
    ),
    Effect.catchTags({
      PlatformError: (cause) =>
        EnvironmentError.make({ environment: name, problem: `${file} cannot be read: ${cause.message}` })
    })
  )
  return yield* pipe(
    text,
    S.decodeEffect(S.fromJsonString(TraitsEnvironment), { onExcessProperty: "error" }),
    Effect.mapError((cause) =>
      EnvironmentError.make({
        environment: name,
        problem: `${file} must be JSON like { "traits": ["trait-name"] } listing distinct trait names: ${cause.message}`
      })
    )
  )
})
