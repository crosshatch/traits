import { Console, Effect, FileSystem } from "effect"

import { resolveTemplate } from "./templates.ts"

export const previewTemplate = Effect.fn("site.previewTemplate")(function* (themeRoot: string, name: string) {
  const fs = yield* FileSystem.FileSystem
  const file = resolveTemplate(themeRoot, name)
  const text = yield* fs.readFileString(file)
  yield* Console.log(`${file} (${text.length} characters)`)
  yield* Console.log(text)
})
