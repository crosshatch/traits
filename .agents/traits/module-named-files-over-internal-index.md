---
name: module-named-files-over-internal-index
subject: Filenames for internal modules, directory entry modules, and barrels.
requirement: Use the module's name instead of index.ts for internal modules,
  including barrels and the core module of a directory representing that module.
  Keep a directory's core module inside that directory, such as Cli/Cli.ts or
  auth/auth.ts. Reserve index.ts for entrypoints exposed as package exports;
  being a barrel alone does not justify index.ts. Update imports when renaming.
purpose: Make module identity and ownership visible in filenames and import
  paths while preserving package export entrypoints.
---
```diff
-import { Cli } from "./Cli/index.ts"
+import { Cli } from "./Cli/Cli.ts"
```

A module directory owns its entry file: use auth/auth.ts rather than a sibling auth.ts.