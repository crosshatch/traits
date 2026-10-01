import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      crosshatch: resolve(import.meta.dirname, "crosshatch/src")
    }
  },
  test: {
    name: "crosshatch",
    include: ["crosshatch/test/**/*.test.ts"],
    passWithNoTests: true
  }
})
