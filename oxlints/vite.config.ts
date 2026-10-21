import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    name: "oxlints",
    include: ["*.test.ts"]
  }
})
