---
name: align-operation-module-and-export-names
subject: Operation-focused modules and their primary exports. In TypeScript,
  TSX, JavaScript, or JSX files.
assertion: For operation-focused modules, keep the filename and primary export
  aligned with the operation's canonical name. When improving that name, rename
  the file and export together and update consumers to import it directly,
  rather than retaining the old source name behind an import alias.
purpose: Make operations easy to locate and recognize without tracing aliases
  across modules.
---

```diff
-import { evaluate as check } from "./evaluate.ts"
+import { check } from "./check.ts"
```

Not a violation: a module named for a thing or an activity and consumed through a namespace import, whose export is the verb on it, such as Check.ts exporting `check` (`Check.check`), Evaluation.ts exporting `evaluate` (`Evaluation.evaluate`), Segmentation.ts exporting `execute` (`Segmentation.execute`), AtomicFile.ts exporting `write` (`AtomicFile.write`), or ToolFailure.ts exporting `describe` (`ToolFailure.describe`). The module name and the export read together as the operation's name, so they are aligned.

Violation: a module imported by name whose one export is unrelated to the file's name, such as Limits.ts exporting only `clampRate` and imported as `import { clampRate } from "./Limits.ts"`; name the file clampRate.ts.
