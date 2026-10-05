import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    name: "rules",
    include: ["*.test.ts"]
  }
})
