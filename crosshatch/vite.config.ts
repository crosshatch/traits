import { defineConfig } from "vite-plus"

import PackageJson from "./package.json" with { type: "json" }

export default defineConfig({
  root: import.meta.dirname,
  test: {
    name: PackageJson.name,
    include: ["test/**/*.test.ts"],
    passWithNoTests: true
  }
})
