import { Context, Effect, FileSystem, Layer, Path } from "effect"

import { getWorktreeRoot } from "./_util/Git.ts"

export class ProjectPaths extends Context.Service<
  ProjectPaths,
  {
    readonly projectRoot: string
    readonly traitsDirectory: string
  }
>()("traits/ProjectPaths") {}

export const layer = Layer.effect(
  ProjectPaths,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const projectRoot = yield* getWorktreeRoot.pipe(Effect.flatMap(fs.realPath))
    return { projectRoot, traitsDirectory: path.join(projectRoot, ".agents", "traits") }
  })
)
