import react from "@vitejs/plugin-react"
import { defineConfig } from "vite-plus"

import PackageJson from "./package.json" with { type: "json" }

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  test: {
    name: PackageJson.name,
    include: ["test/**/*.test.{ts,tsx}"],
    passWithNoTests: true
  }
})
