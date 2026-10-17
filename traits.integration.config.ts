import { defineConfig } from "vite-plus"

export default defineConfig({
  root: `${import.meta.dirname}/traits`,
  test: {
    include: ["integration/**/*.test.ts"],
    name: "traits-integration",
    testTimeout: 120_000
  }
})
