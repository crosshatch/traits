import { defineConfig } from "vite-plus"

export default defineConfig({
  test: {
    name: "tasks",
    include: ["traits/**/*.test.ts"]
  }
})
