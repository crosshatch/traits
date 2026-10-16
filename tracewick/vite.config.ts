import { defineConfig } from "vite-plus"

export default defineConfig({
  root: import.meta.dirname,
  test: { name: "tracewick", include: ["test/**/*.test.ts"], testTimeout: 30000 }
})
