import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  test: {
    name: "crosshatch.dev",
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
    fileParallelism: false,
    maxWorkers: 1,
    retry: 0,
    testTimeout: 120_000,
    hookTimeout: 180_000,
    sequence: {
      concurrent: false,
      hooks: "list"
    },
    env: {
      ALCHEMY_TEST_DEV: "false",
      ALCHEMY_DEV: "false"
    }
  }
})
