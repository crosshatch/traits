import { Function, type Ordering, Result, Schema as S, SemVer, SemVerRange } from "effect"

/** A semantic version such as 1.2.3 or 0.4.0-beta.1. */
export type Version = typeof Version.Type
export const Version = S.String.check(
  S.makeFilter((version) => Result.isSuccess(SemVer.parse(version)), {
    message: "Expected a semantic version such as 1.2.3 or 0.4.0-beta.1"
  })
).annotate({ description: "A semantic version such as 1.2.3 or 0.4.0-beta.1." })

/** Compares versions by semantic version precedence, where a release is newer than its prereleases. */
export const compare: {
  (that: string): (self: string) => Ordering.Ordering
  (self: string, that: string): Ordering.Ordering
} = Function.dual(2, (self: string, that: string) => SemVer.Order(SemVer.parseUnsafe(self), SemVer.parseUnsafe(that)))

/** Whether a version is newer than another by semantic version precedence. */
export const isNewer: {
  (that: string): (self: string) => boolean
  (self: string, that: string): boolean
} = Function.dual(2, (self: string, that: string) => compare(self, that) === 1)

/** How a configured version relates to the installed one under caret (^) semantics: Compatible when the installed version satisfies ^configured. */
export type VersionStatus = "Compatible" | "Older" | "Newer"

/** Compares a configured version with the installed one using caret (^) compatibility, letting prereleases satisfy it. */
export const status: {
  (installed: string): (configured: string) => VersionStatus
  (configured: string, installed: string): VersionStatus
} = Function.dual(2, (configured: string, installed: string): VersionStatus => {
  if (isNewer(configured, installed)) {
    return "Newer"
  }
  // ^1.2.3 allows 1.x.y, ^0.2.3 allows 0.2.y, and ^0.0.3 allows only 0.0.3.
  return SemVerRange.matches(SemVerRange.caret(SemVer.parseUnsafe(configured)), SemVer.parseUnsafe(installed), {
    includePrerelease: true
  })
    ? "Compatible"
    : "Older"
})
