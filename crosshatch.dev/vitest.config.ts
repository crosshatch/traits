import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  test: {
    name: "crosshatch.dev:unit",
    environment: "node",
    include: ["test/unit/**/*.test.{ts,tsx}"],
    passWithNoTests: true
  }
})
