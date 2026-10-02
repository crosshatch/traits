import { defineConfig } from "vite-plus"

import PackageJson from "./package.json" with { type: "json" }

export default defineConfig({
  root: import.meta.dirname,
  pack: {
    entry: ["src/**/*.ts"],
    unbundle: true,
    format: "esm",
    target: "es2022",
    sourcemap: true,
    outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
    tsconfig: "tsconfig.release.json",
    dts: { sourcemap: true }
  },
  test: {
    name: PackageJson.name,
    include: ["test/**/*.test.ts"],
    passWithNoTests: true
  }
})
