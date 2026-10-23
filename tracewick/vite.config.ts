import { defineConfig } from "vite-plus"

export default defineConfig({
  root: import.meta.dirname,
  test: { include: ["test/**/*.test.ts"], name: "tracewick", testTimeout: 60000 }
})
