import { createHash } from "node:crypto"
import { userInfo } from "node:os"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig(() => {
  const worktree = createHash("sha256").update(root).digest("hex").slice(0, 8)
  const user = userInfo().username.toLowerCase().replace(/[^a-z0-9-]/g, "-")
  const run = process.env.GITHUB_RUN_ID
  const explicitStage = process.env.ALCHEMY_TEST_STAGE
  if (process.env.CI && !run && !explicitStage) {
    throw new Error("Set ALCHEMY_TEST_STAGE to a unique CI run/attempt/shard identifier.")
  }
  const stage = explicitStage || (run
    ? `test-${run}-${process.env.GITHUB_RUN_ATTEMPT || "1"}-live`
    : `test-${user}-${worktree}-live`)

  return {
    root,
    test: {
      name: "crosshatch.dev:integration",
      environment: "node",
      include: ["test/integration/**/*.test.{ts,tsx}"],
      passWithNoTests: false,
      fileParallelism: false,
      maxWorkers: 1,
      retry: 0,
      testTimeout: 120_000,
      hookTimeout: 180_000,
      teardownTimeout: 30_000,
      sequence: {
        concurrent: false,
        hooks: "list" as const
      },
      env: {
        ALCHEMY_PROFILE: process.env.ALCHEMY_PROFILE || "testing",
        ALCHEMY_TEST_STAGE: stage,
        ALCHEMY_TEST_DEV: "false",
        ALCHEMY_DEV: "false",
        NO_DESTROY: ""
      }
    }
  }
})
