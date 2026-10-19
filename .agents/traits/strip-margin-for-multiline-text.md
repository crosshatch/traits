---
name: strip-margin-for-multiline-text
subject: Large multiline text literals using Effect String.stripMargin.
requirement: |-
  Write large text strings as multiline template literals using Effect’s String.stripMargin, with a leading | on each text line. Align every | and the closing backtick with the containing statement or property when it directly calls stripMargin, without an extra indentation level: instructions: String.stripMargin(`
  | text
  `), not instructions: String.stripMargin(`
    | text
  `) (
   denotes a line break). Do not align markers with a distant outer property when the stripMargin call is nested deeper inside a ternary, argument, or other expression. Instead extract the text into a named constant and align with that declaration: const guidance = String.stripMargin(`
  | text
  `); use guidance in the nested expression.
applicability: |-
  Applies when writing large multiline text strings with Effect String.stripMargin.
  File types or languages: text/typescript, text/tsx.
---
```diff
 const instructions = String.stripMargin(`
-  | Keep the text concise.
-  `)
+| Keep the text concise.
+`)
```
