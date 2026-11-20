import { Array, pipe, Schema as S, String } from "effect"

import { type Input, primarySource, targetText } from "./util/Input.ts"
import { WorkspacePath } from "./util/WorkspacePath.ts"

/** Segment-scoped evidence: the target once and only explicitly mapped historical excerpts. */
export type DecisionState = typeof DecisionState.Type
export const DecisionState = S.Struct({
  /** The workspace path of the file the target was selected from. */
  path: WorkspacePath.annotateKey({ description: "The workspace path of the file the target was selected from." }),
  /** The file version the target was selected from: after for current text, before for text that was deleted. */
  version: S.Literals(["after", "before"]).annotateKey({
    description:
      "The file version the target was selected from: after for current text, before for text that was deleted."
  }),
  /** The selected text to assess. */
  target: S.String.annotateKey({ description: "The selected text to assess." }),
  /** Earlier excerpts corresponding to target; absent when the correspondence is unknown. */
  history: S.Struct({
    path: WorkspacePath.annotateKey({ description: "The path of the earlier source version." }),
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

/** Builds the decision state for an input without repeating text or sending earlier text whose correspondence is unknown. */
export const fromInput = (input: Input): DecisionState => {
  const source = primarySource(input)
  const target = targetText(input)
  const before = input.change.before
  return {
    path: source.path,
    version: input._tag === "After" ? "after" : "before",
    target,
    ...(input._tag === "After" && before !== undefined && input.segment.before !== undefined
      ? {
          history: {
            path: before.path,
            excerpts: Array.map(input.segment.before, (range) =>
              pipe(before.text, String.slice(range.start, range.end))
            )
          }
        }
      : {})
  }
}
