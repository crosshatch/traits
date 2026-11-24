import { NodeServices } from "@effect/platform-node"
import { expect, layer } from "@effect/vitest"
import { Array, Effect, FileSystem, Layer, Path, pipe, String } from "effect"
import { UserDirectories } from "effect/persistence"

import * as Segmentation from "../local/Segmentation/Segmentation.ts"
import * as TraitsConfig from "../local/TraitsConfig/TraitsConfig.ts"
import { configText, localPaths } from "./_localWorkspace.ts"

const module = pipe(
  `
  |// A header 😀
  |import a from "a"
  |import { b } from "b"
  |export * from "./c"
  |
  |/** Documents x. */
  |export const x = "😀" // trails x
  |
  |function f() {
  |  // inside f
  |
  |  return a + b
  |}
  |
  |export { f } from "./d"
  |`,
  String.stripMargin,
  String.trimStart
)

/** The text each range selects. */
const texts = (text: string, ranges: ReadonlyArray<{ readonly start: number; readonly end: number }>) =>
  Array.map(ranges, ({ end, start }) => pipe(text, String.slice(start, end)))

layer(Layer.mergeAll(NodeServices.layer, UserDirectories.layer))((it) => {
  it.effect(
    "divides a TypeScript file into its top-level statements, with their comments and with module links together",
    () =>
      Effect.gen(function* () {
        const segment = yield* Segmentation.prepare([])
        expect(texts(module, segment("src/module.ts", module))).toEqual([
          '// A header 😀\nimport a from "a"\nimport { b } from "b"\nexport * from "./c"',
          '/** Documents x. */\nexport const x = "😀" // trails x',
          "function f() {\n  // inside f\n\n  return a + b\n}",
          'export { f } from "./d"'
        ])
      })
  )

  it.effect("keeps a file whole when it is not JavaScript or TypeScript, does not parse, or has no statements", () =>
    Effect.gen(function* () {
      const segment = yield* Segmentation.prepare([])
      const whole = (text: string) => [{ start: 0, end: text.length }]
      expect(segment("notes.md", "# Notes\n\nText.\n")).toEqual(whole("# Notes\n\nText.\n"))
      expect(segment("broken.ts", "const = ;\n")).toEqual(whole("const = ;\n"))
      expect(segment("comment.js", "// Nothing here.\n")).toEqual(whole("// Nothing here.\n"))
      const page = "export const a = <div>hi</div>\nexport const b = 1\n"
      expect(texts(page, segment("page.tsx", page))).toEqual(["export const a = <div>hi</div>", "export const b = 1"])
    })
  )

  it.effect("lets the given rules decide before the built-in ones, the first match winning", () =>
    Effect.gen(function* () {
      const segment = yield* Segmentation.prepare([
        { files: "generated/**", by: "file" },
        { files: "bin/*", by: "typescript" },
        { files: "**/*.{ts,tsx}", by: "typescript" }
      ])
      const text = "export const a = 1\nexport const b = 2\n"
      expect(segment("generated/client.ts", text)).toHaveLength(1)
      expect(segment("src/a.ts", text)).toHaveLength(2)
      // A rule can name files that the built-in rules would not take for JavaScript.
      expect(segment("bin/tool", "const a = 1\nconst b = 2\n")).toHaveLength(2)
    })
  )

  it.effect("reports segmentation rules that are not valid as a malformed configuration", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const traits = yield* fs.makeTempDirectoryScoped()
      yield* fs.writeFileString(
        path.join(traits, "config.json"),
        configText({ segmentation: [{ files: "**/*.ts", by: "paragraphs" }] })
      )
      const error = yield* Effect.flip(TraitsConfig.load).pipe(Effect.provide(localPaths(traits)))
      expect(error).toMatchObject({ _tag: "StorageError", reason: { _tag: "Malformed" } })
    })
  )
})
