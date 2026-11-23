import { Array, Function, pipe, Result, Schema as S, String } from "effect"

import { type Input, primarySource, targetText } from "../Input/Input.ts"

/** Segment-scoped evidence: the target once and only explicitly mapped historical excerpts. */
export type Evidence = typeof Evidence.Type
export const Evidence = S.Struct({
  /** Where the file the target was selected from lives: its path relative to the workspace root, or its URL when it is outside the workspace. */
  location: S.String.annotateKey({
    description:
      "Where the file the target was selected from lives: its path relative to the workspace root, or its URL when it is outside the workspace."
  }),
  /** The file version the target was selected from: after for current text, before for text that was deleted. */
  version: S.Literals(["after", "before"]).annotateKey({
    description:
      "The file version the target was selected from: after for current text, before for text that was deleted."
  }),
  /** The selected text to assess. */
  target: S.String.annotateKey({ description: "The selected text to assess." }),
  /** Earlier excerpts corresponding to target; absent when the correspondence is unknown. */
  history: S.Struct({
    /** Where the earlier source version lives, relative to the workspace root or as a URL. */
    location: S.String.annotateKey({
      description: "Where the earlier source version lives, relative to the workspace root or as a URL."
    }),
    /** Only mapped text, never the enclosing historical file; empty for a known-new target. */
    excerpts: S.Array(S.String).annotateKey({
      description: "Earlier text excerpts corresponding to target; empty when target has no earlier counterpart."
    })
  })
    .annotateKey({
      description:
        "Only the mapped earlier excerpts corresponding to target; present when that correspondence is known."
    })
    .pipe(S.optionalKey)
}).annotate({
  description: "Segment-scoped evidence: the target once and only explicitly mapped historical excerpts."
})

/** A source's location without machine-specific parts: its path relative to the workspace root when it is a file inside the workspace, and its URL otherwise. */
const location = (uri: URL, root: URL): string => {
  const directory = pipe(root.pathname, String.endsWith("/")) ? root.pathname : `${root.pathname}/`
  if (uri.protocol !== "file:" || uri.host !== root.host || !pipe(uri.pathname, String.startsWith(directory))) {
    return uri.href
  }
  const relative = pipe(uri.pathname, String.slice(directory.length))
  // A file URL may hold a percent sign that does not start an escape, which cannot be decoded.
  return Result.getOrElse(
    Result.try(() => decodeURIComponent(relative)),
    () => relative
  )
}

/** Builds the evidence for an input in the workspace with this root, without repeating text or sending earlier text whose correspondence is unknown. */
export const fromInput: {
  (root: URL): (input: Input) => Evidence
  (input: Input, root: URL): Evidence
} = Function.dual(2, (input: Input, root: URL): Evidence => {
  const before = input.change.before
  return {
    location: location(primarySource(input).uri, root),
    version: input._tag === "After" ? "after" : "before",
    target: targetText(input),
    ...(input._tag === "After" && before !== undefined && input.segment.before !== undefined
      ? {
          history: {
            location: location(before.uri, root),
            excerpts: Array.map(input.segment.before, (range) =>
              pipe(before.text, String.slice(range.start, range.end))
            )
          }
        }
      : {})
  }
})
