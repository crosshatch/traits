import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      crosshatch: fileURLToPath(new URL("./crosshatch/src", import.meta.url))
    }
  },
  test: {
    name: "crosshatch",
    include: ["crosshatch/test/**/*.test.ts"],
    passWithNoTests: true
  }
})
