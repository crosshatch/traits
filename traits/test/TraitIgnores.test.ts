import { expect, it } from "vite-plus/test"

import { traitIgnores } from "../traitIgnores.ts"

it("reads repeated directives from the leading header", () => {
  const names = traitIgnores(
    "#!/usr/bin/env node\n\n// header\n// traits-ignore-file first: reason\n// traits-ignore-file second: another reason\nimport 'module'"
  )
  expect([...names]).toEqual(["first", "second"])
})

it("requires a reason and exactly one name", () => {
  expect([
    ...traitIgnores(
      "// traits-ignore-file first\n// traits-ignore-file second:   \n// traits-ignore-file first second: reason"
    )
  ]).toEqual([])
})

it("does not interpret strings or comments after code", () => {
  expect([
    ...traitIgnores("const text = `\n// traits-ignore-file first: reason\n`\n// traits-ignore-file second: reason")
  ]).toEqual([])
})

it("handles CRLF and deduplicates names", () => {
  expect([...traitIgnores("// traits-ignore-file first: reason\r\n// traits-ignore-file first: repeated\r\n")]).toEqual(
    ["first"]
  )
})
