import { expect, it } from "@effect/vitest"
import { Array, Schema as S } from "effect"

import * as Version from "../Version.ts"

it("accepts only semantic versions", () => {
  const isVersion = S.is(Version.Version)
  expect(Array.every(["1.2.3", "0.4.0-beta.1", "1.2.3+build.1"], isVersion)).toBe(true)
  expect(Array.some(["01.2.3", "v1.2.3", "1.2", "internal"], isVersion)).toBe(false)
})

it("orders a release after its prereleases", () => {
  expect(Version.isNewer("1.0.0", "1.0.0-beta.2")).toBe(true)
  expect(Version.isNewer("1.0.0-beta.2", "1.0.0-beta.1")).toBe(true)
  expect(Version.isNewer("1.0.0", "1.0.0")).toBe(false)
  expect(Version.compare("0.10.0", "0.9.0")).toBe(1)
})
