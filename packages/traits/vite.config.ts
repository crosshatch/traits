import { NodeServices } from "@effect/platform-node"
import { Effect, Path, String } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import { defineConfig } from "vite-plus"

import PackageJson from "./package.json" with { type: "json" }

const fileName = "traits"
const outDir = "dist/executable"

export default defineConfig({
  root: import.meta.dirname,
  pack: {
    entry: "main.ts",
    format: "esm",
    platform: "node",
    outDir: "dist/bundle",
    deps: { alwaysBundle: [/./], onlyBundle: false },
    exe: { outDir, fileName },
    hooks: {
      "build:done": Effect.fn(
        function* () {
          // Fails the build unless the executable starts on its own. This also catches a failed macOS signature,
          // which packing only warns about: macOS kills an unsigned executable on launch.
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
        },
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
