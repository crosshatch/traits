import { Schema as S } from "effect"

/** A way of dividing a file into the segments that are checked on their own: file keeps the whole file as one segment, and typescript makes each top-level statement of a JavaScript or TypeScript file a segment, with its comments, keeping runs of imports and re-exports together. */
export type SegmentationStrategy = typeof SegmentationStrategy.Type
export const SegmentationStrategy = S.Literals(["file", "typescript"]).annotate({
  description:
    "A way of dividing a file into the segments that are checked on their own: file keeps the whole file as one segment, and typescript makes each top-level statement of a JavaScript or TypeScript file a segment, with its comments, keeping runs of imports and re-exports together."
})

/** Which files a way of dividing files into segments applies to. */
export type SegmentationRule = typeof SegmentationRule.Type
export const SegmentationRule = S.Struct({
  /** A glob pattern, relative to the workspace root, for the files the rule applies to, such as src/**, written as a trait's match patterns are: * matches within one name, ** across directories, and {a,b} either alternative. */
  files: S.NonEmptyString.annotateKey({
    description:
      "A glob pattern, relative to the workspace root, for the files the rule applies to, such as src/**, written as a trait's match patterns are: * matches within one name, ** across directories, and {a,b} either alternative."
  }),
  /** How those files are divided. */
  by: SegmentationStrategy.annotateKey({ description: "How those files are divided." })
}).annotate({ description: "Which files a way of dividing files into segments applies to." })
