import { Effect, FileSystem } from "effect"

import { bundleAssets } from "./assets.ts"
import { renderPage } from "./templates.ts"

export const build = Effect.fn("site.build")(function* (root: string, outDir: string) {
  const fs = yield* FileSystem.FileSystem
  const assets = yield* bundleAssets(root)
  const html = yield* renderPage(root, "Home", `<script>${assets.script}</script>`)
  yield* fs.makeDirectory(outDir, { recursive: true })
  yield* fs.writeFileString(`${outDir}/index.html`, html)
  yield* fs.writeFileString(`${outDir}/app.css`, assets.style)
  yield* fs.writeFileString(`${outDir}/icon.svg`, assets.icon)
})
