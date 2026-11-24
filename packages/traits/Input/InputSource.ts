import { Schema as S } from "effect"

/** One text-only file version with its own location and complete contents. */
export type InputSource = typeof InputSource.Type
export const InputSource = S.Struct({
  /** Where this source version lives, including historical or renamed locations: a file: URL for a local file, or an https: URL for a remote one. */
  uri: S.URLFromString.check(
    S.makeFilter((uri) => uri.protocol === "file:" || uri.protocol === "https:", {
      message: "Expected a file: or https: URL."
    })
  ).annotate({
    description:
      "Where this source version lives, including historical or renamed locations: a file: URL for a local file, or an https: URL for a remote one."
  }),
  /** The complete decoded text of this source version. */
  text: S.String.annotate({ description: "The complete decoded text of this source version." })
}).annotate({ description: "One text-only file version with its own location and complete contents." })
