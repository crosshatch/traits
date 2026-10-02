import { presets, recommended } from "@effect/tsgo/oxlint-presets"
import { Record } from "effect"
import { defineConfig } from "vite-plus"

import custom from "./rules/index.ts"

const toolingIgnores = [".agents/**", "repos/**", "**/.worktrees/**"]

export default defineConfig({
  fmt: {
    ignorePatterns: toolingIgnores,
    semi: false,
    trailingComma: "none",
    sortPackageJson: {},
    sortImports: {},
    sortTailwindcss: { functions: ["cn"] },
    proseWrap: "always",
    overrides: [
      {
        files: ["**/*.md", "**/*.mdx"],
        options: { printWidth: 80 }
      }
    ]
  },
  test: {
    projects: ["crosshatch/vite.config.ts", "crosshatch.dev/vite.config.ts"]
  },
  lint: {
    extends: [recommended],
    ignorePatterns: toolingIgnores,
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "custom", specifier: "./rules/index.ts" }
    ],
    rules: {
      ...Record.mapEntries(
        {
          ...presets.correctness.rules,
          ...presets.antipattern.rules,
          ...presets.effectNative.rules,
          ...presets.style.rules
        },
        (_, name) => [name, "error"] as const
      ),
      "effecttsgo/experimental-api-usage": "error",
      "effecttsgo/unstable-api-usage": "off",
      "effecttsgo/strict-effect-provide": "off",
      "effecttsgo/lazy-effect": "off",
      "effecttsgo/return-effect-in-gen": "off",
      "effecttsgo/layer-merge-all-with-dependencies": "off",
      "effecttsgo/prefer-schema-over-json": "off",
      "effecttsgo/effect-succeed-with-void": "off",
      ...Record.mapEntries(custom.rules, (_, name) => [`custom/${name}`, "error"] as const),
      "vite-plus/prefer-vite-plus-imports": "error"
    },
    options: { typeAware: true, typeCheck: true }
  }
})
