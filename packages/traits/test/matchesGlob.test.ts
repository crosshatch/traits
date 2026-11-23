import { expect, it } from "@effect/vitest"

import { matchesGlob } from "../util/matchesGlob.ts"

it.each([
  ["**/*.{ts,tsx}", "a.ts", true],
  ["**/*.{ts,tsx}", "src/deep/a.tsx", true],
  ["**/*.{ts,tsx}", "a.tsx.bak", false],
  ["**/*.{ts,tsx}", "a.js", false],
  ["*.ts", "a.ts", true],
  ["*.ts", "src/a.ts", false],
  ["traits.sh/**", "traits.sh/src/App.tsx", true],
  ["traits.sh/**", "other/traits.sh/a", false],
  ["traits.sh/**/*.{ts,html,md}", "traits.sh/index.html", true],
  ["{**/package.json,pnpm-workspace.yaml}", "packages/traits/package.json", true],
  ["{**/package.json,pnpm-workspace.yaml}", "pnpm-workspace.yaml", true],
  ["{**/package.json,pnpm-workspace.yaml}", "package.json5", false],
  ["src/{a,b{c,d}}/*.ts", "src/bd/x.ts", true],
  ["src/{a,b{c,d}}/*.ts", "src/b/x.ts", false],
  ["a?.ts", "ab.ts", true],
  ["a?.ts", "a/.ts", false],
  ["**/vite.config.ts", "vite.config.ts", true],
  ["a.b", "axb", false],
  ["a+(b)[c]", "a+(b)[c]", true],
  ["{unclosed", "{unclosed", true],
  ["**", "anything/at/all.x", true],
  ["**/*.md", ".github/x.md", true]
] as const)("%s against %s is %s", (pattern, path, expected) => {
  expect(matchesGlob(pattern)(path)).toBe(expected)
})
