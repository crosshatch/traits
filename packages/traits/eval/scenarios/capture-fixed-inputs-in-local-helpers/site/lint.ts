import { Array, Effect, FileSystem } from "effect"

import { resolveTemplate } from "./templates.ts"

export const lintTemplates = Effect.fn("site.lintTemplates")(function* (
  roots: ReadonlyArray<string>,
  names: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem
  const files = Array.flatMap(roots, (root) => Array.map(names, (name) => resolveTemplate(root, name)))
  const present = yield* Effect.forEach(files, (file) => fs.exists(file))
  return Array.filter(files, (_, index) => present[index] !== true)
})
