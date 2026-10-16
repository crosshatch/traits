import { pipe } from "effect"
import { expect, it } from "vite-plus/test"

import * as Trait from "../Trait.ts"
import { excludeIgnored, traitIgnores } from "../traitIgnores.ts"

const first = Trait.Trait.make({
  id: Trait.TraitId.make("2535ceab-5702-4ab4-932a-f87362adf8c6"),
  name: Trait.TraitName.make("direct-callbacks"),
  body: "Pass callbacks directly."
})
const second = Trait.Trait.make({ ...first, id: Trait.TraitId.make("8ab974ba-e001-49cc-b6a7-1b2cd9a19bb8") })
const third = Trait.Trait.make({
  ...first,
  id: Trait.TraitId.make("d015da5c-3fd6-4673-b5c8-d308680e9224"),
  name: Trait.TraitName.make("use-arrow-functions")
})

it("reads repeated directives from the leading header", () => {
  const references = traitIgnores(
    "#!/usr/bin/env node\n\n// header\n// traits-ignore-file first: reason\n// traits-ignore-file second: another reason\nimport 'module'"
  )
  expect([...references]).toEqual(["first", "second"])
})

it("requires a reason and exactly one reference", () => {
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

it("handles CRLF and deduplicates references", () => {
  expect([...traitIgnores("// traits-ignore-file first: reason\r\n// traits-ignore-file first: repeated\r\n")]).toEqual(
    ["first"]
  )
})

it("accepts UUID and name directives in the same header", () => {
  const header = `// traits-ignore-file ${first.id}: specific exception\n// traits-ignore-file ${third.name}: named exception\nconst value = 1`
  expect([...traitIgnores(header)]).toEqual([first.id, third.name])
  expect(pipe([first, second, third], excludeIgnored(header))).toEqual([second])
})

it("ignores every trait with an exact matching name", () => {
  expect(pipe([first, second, third], excludeIgnored(`// traits-ignore-file ${first.name}: shared exception`))).toEqual(
    [third]
  )
})

it("uses UUIDs for a single-trait exception even when names are duplicated", () => {
  expect(pipe([first, second], excludeIgnored(`// traits-ignore-file ${first.id}: specific exception`))).toEqual([
    second
  ])
})

it("does not match partial names, different casing, filenames, or unknown references", () => {
  const header = `// traits-ignore-file direct: partial\n// traits-ignore-file Direct-callbacks: wrong casing\n// traits-ignore-file ${first.name}-${first.id}.md: filename\n// traits-ignore-file unknown-trait: unknown`
  expect(pipe([first, second, third], excludeIgnored(header))).toEqual([first, second, third])
})

it("preserves UUID exceptions across renames without treating old names as aliases", () => {
  const renamed = Trait.Trait.make({ ...first, name: Trait.TraitName.make("renamed-callbacks") })
  expect(pipe([renamed], excludeIgnored(`// traits-ignore-file ${first.id}: stable identity`))).toEqual([])
  expect(pipe([renamed], excludeIgnored(`// traits-ignore-file ${first.name}: old name`))).toEqual([renamed])
})

it("does not apply directives without reasons or after code", () => {
  expect(pipe([first], excludeIgnored(`// traits-ignore-file ${first.name}:   `))).toEqual([first])
  expect(pipe([first], excludeIgnored(`const value = 1\n// traits-ignore-file ${first.id}: too late`))).toEqual([first])
})
