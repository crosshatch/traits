---
name: namespace-imports-for-local-modules
subject: Imports of multiple related exports from local project modules.
requirement: Prefer namespace imports and qualified member access when importing
  more than two exports or when multiple exports would otherwise have aliases
  sharing a module-name prefix.
applicability: Applies in TypeScript, TSX, JavaScript, and JSX files. Excludes
  imports from project-level schema utility modules and barrels, which use named
  imports instead.
purpose: Make related local exports visibly belong to their module without
  repetitive aliases or crowded named imports.
---
For example, use `import * as Trait from "./Trait.ts"` with `Trait.parse`, `Trait.serialize`, `Trait.Trait`, and `Trait.TraitName`.

```diff
-import { parse, serialize, Trait } from "./Trait.ts"
+import * as Trait from "./Trait.ts"
```