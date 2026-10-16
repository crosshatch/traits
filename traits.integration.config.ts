import { defineConfig } from "vite-plus"

export default defineConfig({
  root: `${import.meta.dirname}/traits`,
  test: {
    name: "traits-integration",
    include: ["integration/**/*.test.ts"],
    testTimeout: 120_000
  }
})
