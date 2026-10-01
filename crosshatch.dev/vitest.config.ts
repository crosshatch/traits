import { defineConfig } from "vitest/config"

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: "crosshatch.dev",
    include: ["test/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 180_000,
    sequence: {
      hooks: "list"
    },
    env: {
      ALCHEMY_TEST_DEV: "false",
      ALCHEMY_DEV: "false"
    }
  }
})
