import { Function, pipe, Result, Schema as S, String } from "effect"

import { type Input, targetText } from "../Input/Input.ts"

/** Segment-scoped evidence: the target once, without its enclosing file. */
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
  target: S.String.annotateKey({ description: "The selected text to assess." })
}).annotate({
  description: "Segment-scoped evidence: the target once, without its enclosing file."
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

/** Builds the evidence for an input in the workspace with this root, without repeating text. */
export const fromInput: {
  (root: URL): (input: Input) => Evidence
  (input: Input, root: URL): Evidence
} = Function.dual(2, (input: Input, root: URL): Evidence => ({
  location: location(input.source.uri, root),
  version: input.version,
  target: targetText(input)
}))
