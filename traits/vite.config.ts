import { defineConfig } from "vite-plus"

import PackageJson from "./package.json" with { type: "json" }

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ["test/**/*.test.ts"],
    name: PackageJson.name,
    testTimeout: 60000,
    passWithNoTests: true
  }
})
