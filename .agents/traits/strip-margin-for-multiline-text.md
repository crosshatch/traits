---
name: strip-margin-for-multiline-text
purpose: Keep multiline text readable in source without leaking incidental code indentation into its content.
subject: Large multiline text literals in TypeScript and TSX, whether or not Effect String.stripMargin is already used.
requirement: |-
  Write large text strings as multiline template literals using Effect’s String.stripMargin, with a leading | on each text line. This requires using String.stripMargin for raw multiline text literals as well: its absence is a violation, not a reason to skip assessment. Align every | and the closing backtick with the containing statement or property when it directly calls stripMargin, without an extra indentation level. Do not align markers with a distant outer property when the stripMargin call is nested deeper inside a ternary, argument, or other expression. Instead extract the text into a named constant and align with that declaration; use the constant in the nested expression.
applicability: |-
  Includes embedded Markdown, prompts, instructions, and illustrative code or diffs.
---
Check two independent conditions: the large multiline literal uses Effect String.stripMargin, and its margin markers and closing backtick are aligned correctly. Correct rendered output alone does not satisfy the first condition. Preserve meaningful indentation after the margin markers. Explicit trimming may preserve intentional leading/trailing newline behavior.

Missing String.stripMargin is a violation:

```diff
-const instructions = `Keep the text concise.
-Preserve important details.
-Explain the exceptions.`
+const instructions = String.stripMargin(`
+|Keep the text concise.
+|Preserve important details.
+|Explain the exceptions.
+`)
```

Marker alignment:

```diff
 const instructions = String.stripMargin(`
-  | Keep the text concise.
-  `)
+| Keep the text concise.
+`)
```

Direct property call:

```ts
const example = {
  instructions: String.stripMargin(`
  | text
  `)
}
```
