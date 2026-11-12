import { Effect, FileSystem } from "effect"

export const resolveAsset = (root: string, name: string) => `${root}/public/assets/${name}`

export const bundleAssets = Effect.fn("site.bundleAssets")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem
  const script = yield* fs.readFileString(resolveAsset(root, "app.js"))
  const style = yield* fs.readFileString(resolveAsset(root, "app.css"))
  const icon = yield* fs.readFileString(resolveAsset(root, "icon.svg"))
  return { script, style, icon }
})
