import { expect, it } from "@effect/vitest"
import { Schema as S } from "effect"

import * as Traits from "../Trait.ts"

const decode = S.decodeUnknownSync(Traits.Trait, { onExcessProperty: "error" })
const minimal = { name: "example", subject: "Source code", purpose: "Maintain quality" }

it("allows omitted optional fields but rejects explicit undefined", () => {
  expect(decode(minimal)).toEqual(minimal)
  for (const field of ["assertion", "enrichments", "body"]) {
    expect(() => decode({ ...minimal, [field]: undefined })).toThrow()
  }
})

it("rejects unknown fields", () => {
  expect(() => decode({ ...minimal, requirment: "Typo" })).toThrow()
})

it("rejects surrounding whitespace in names", () => {
  for (const name of [" example", "example ", "example\n"]) {
    expect(() => decode({ ...minimal, name })).toThrow()
  }
})

it("accepts local and package references, including duplicates", () => {
  const enrichments = ["@traits/typescript", "./local script.ts", "@traits/typescript"]
  expect(decode({ ...minimal, enrichments }).enrichments).toEqual(enrichments)
})

it("rejects empty, padded, and multiline references", () => {
  expect(() => decode({ ...minimal, enrichments: [] })).toThrow()
  for (const reference of ["", " ", " pkg", "pkg ", "pkg\nother", "pkg\r", "pkg\u2028other", "pkg\u2029other"]) {
    expect(() => decode({ ...minimal, enrichments: [reference] })).toThrow()
  }
})

it("accepts omitted, empty, multiline, and encrypted body", () => {
  expect(decode(minimal).body).toBeUndefined()
  for (const body of [
    "",
    "\n# Supporting context\n",
    "-----BEGIN ENCRYPTED MESSAGE-----\nabc\n-----END ENCRYPTED MESSAGE-----"
  ]) {
    expect(decode({ ...minimal, body }).body).toBe(body)
  }
})

it("rejects nonempty whitespace-only body", () => {
  for (const body of [" ", "\n", "\t\r\n"]) {
    expect(() => decode({ ...minimal, body })).toThrow()
  }
})

it("enforces character limits", () => {
  for (const [field, maximum] of [
    ["subject", 500],
    ["assertion", 4_000],
    ["purpose", 2_000],
    ["body", 1_000_000]
  ] as const) {
    expect(() => decode({ ...minimal, [field]: "x".repeat(maximum) })).not.toThrow()
    expect(() => decode({ ...minimal, [field]: "x".repeat(maximum + 1) })).toThrow()
  }
  expect(() => decode({ ...minimal, name: "x".repeat(200) })).not.toThrow()
  expect(() => decode({ ...minimal, name: "x".repeat(201) })).toThrow()
  expect(() => decode({ ...minimal, enrichments: ["x".repeat(2_048)] })).not.toThrow()
  expect(() => decode({ ...minimal, enrichments: ["x".repeat(2_049)] })).toThrow()
  expect(() => decode({ ...minimal, enrichments: Array.from({ length: 32 }, () => "pkg") })).not.toThrow()
  expect(() => decode({ ...minimal, enrichments: Array.from({ length: 33 }, () => "pkg") })).toThrow()
})
