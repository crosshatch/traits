import { readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

import { NodeServices } from "@effect/platform-node"
import { Array, Effect, FileSystem, Path, pipe, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { defineConfig } from "vite-plus"

import { embeddedParser } from "./local/Segmentation/segmenters/typescript.ts"
import PackageJson from "./package.json" with { type: "json" }

const fileName = "traits"
const outDir = "dist/executable"

// The executable cannot load packages, so it carries the native library of the parser that was installed for the
// platform it is built on. The library sits in a package beside the parser's own.
const parserLibraries = join(dirname(createRequire(import.meta.url).resolve("oxc-parser")), "..", "..", "@oxc-parser")
const parserLibrary = pipe(
  readdirSync(parserLibraries),
  Array.flatMap((binding) =>
    pipe(
      readdirSync(join(parserLibraries, binding)),
      Array.filter(String.endsWith(".node")),
      Array.map((library) => join(parserLibraries, binding, library))
    )
  ),
  Array.head
)
if (parserLibrary._tag === "None") {
  throw new Error(`No native library for the TypeScript parser is installed under ${parserLibraries}.`)
}

export default defineConfig({
  root: import.meta.dirname,
  pack: {
    entry: "main.ts",
    format: "esm",
    platform: "node",
    outDir: "dist/bundle",
    deps: { alwaysBundle: [/./], onlyBundle: false },
    exe: { outDir, fileName, seaConfig: { assets: { [embeddedParser]: parserLibrary.value } } },
    hooks: {
      "build:done": Effect.fn(
        function* () {
          // Fails the build unless the executable starts on its own. This also catches a failed macOS signature,
          // which packing only warns about: macOS kills an unsigned executable on launch.
          const fs = yield* FileSystem.FileSystem
          const path = yield* Path.Path
          const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
          // Packing appends .exe on Windows.
          const file = path.join(import.meta.dirname, outDir, fileName + (process.platform === "win32" ? ".exe" : ""))
          const expected = `traits v${PackageJson.version}`
          // An empty PATH proves the executable does not rely on an installed Node.js.
          const output = yield* spawner
            .string(ChildProcess.make({ env: { PATH: "" }, extendEnv: true })`${file} --version`, {
              includeStderr: true
            })
            .pipe(Effect.map(String.trim))
          if (output !== expected) {
            return yield* Effect.die(`${file} --version printed "${output}", not "${expected}".`)
          }

          // Fails the build unless the executable can parse with the parser it carries, by running it in a workspace with
          // a TypeScript file of two statements and a default selection of no traits, which asks no model anything.
          const workspace = yield* fs.makeTempDirectoryScoped()
          yield* fs.makeDirectory(path.join(workspace, "traits"))
          yield* fs.writeFileString(
            path.join(workspace, "traits", "config.json"),
            JSON.stringify({
              version: PackageJson.version,
              models: {
                language: { provider: "openai", model: "none" },
                decision: { provider: "openai", model: "none" }
              },
              selections: { default: [] }
            })
          )
          yield* fs.writeFileString(path.join(workspace, "a.ts"), "export const a = 1\nexport const b = 2\n")
          yield* spawner.string(ChildProcess.make("git", ["init", "--quiet"], { cwd: workspace }))
          const run = yield* spawner.string(
            ChildProcess.make(file, ["run", "--log-level", "debug"], {
              cwd: workspace,
              // The key only has to be present, and the parser's library is written under the temporary directory rather than the user's cache.
              env: { OPENAI_API_KEY: "none", XDG_CACHE_HOME: path.join(workspace, "cache") },
              extendEnv: true
            }),
            { includeStderr: true }
          )
          if (!pipe(run, String.includes("a.ts: 2 segment(s) to check."))) {
            return yield* Effect.die(
              `${file} run did not divide a TypeScript file into its statements. It printed: ${run}`
            )
          }
        },
        Effect.scoped,
        Effect.provide(NodeServices.layer),
        Effect.runPromise
      )
    }
  },
  test: {
    alias: { vitest: import.meta.resolve("vite-plus/test") },
    server: { deps: { inline: ["@effect/vitest"] } },
    include: ["test/**/*.test.ts"],
    name: PackageJson.name,
    passWithNoTests: true
  }
})
