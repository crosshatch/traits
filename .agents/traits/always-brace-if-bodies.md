---
name: always-brace-if-bodies
subject: Bodies of if, else if, and else branches.
requirement: Always enclose each if, else if, and else branch body in curly
  braces, even when the body is a single statement on one line. An else if chain
  may retain its normal else if syntax, with braces around each branch body.
applicability: TypeScript, TSX, JavaScript, and JSX files.
purpose: Keep conditional control flow explicit and prevent mistakes when adding
  statements.
---
```diff
-if (condition) return value
+if (condition) {
+  return value
+}
```