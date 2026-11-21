import { execFileSync } from "node:child_process"
import path from "node:path"

import { defineConfig } from "vite-plus"

import PackageJson from "./package.json" with { type: "json" }

// The standalone executable embeds the Node.js that runs `vp pack`, so it is built only on this exact release.
const executableNodeVersion = "26.13.1"

// Packing appends .exe to the file name on Windows.
const executable = { fileName: "traits", outDir: "dist/executable" }

export default defineConfig({
  root: import.meta.dirname,
  pack: {
    entry: "main.ts",
    format: "esm",
    platform: "node",
    // Not dist itself: packing cleans its output directory, and dist holds the npm build.
    outDir: "dist/bundle",
    // A single executable application can load only built-in modules, so every dependency is bundled.
    deps: { alwaysBundle: [/./], onlyBundle: false },
    exe: executable,
    hooks: {
      "build:prepare": () => {
        if (process.versions.node !== executableNodeVersion) {
          throw new Error(
            `The traits executable must be built with Node.js ${executableNodeVersion}, not ${process.versions.node}.`
          )
        }
      },
      "build:done": () => {
        // Packing signs the executable but only warns when that fails, and macOS kills an unsigned one on launch.
        if (process.platform === "darwin") {
          execFileSync(
            "codesign",
            ["--verify", "--strict", path.join(import.meta.dirname, executable.outDir, executable.fileName)],
            { stdio: "inherit" }
          )
        }
      }
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
