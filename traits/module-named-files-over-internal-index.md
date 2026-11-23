---
name: module-named-files-over-internal-index
subject: Filenames of internal modules, directory entry modules, and barrels.
  Judged on the checked file's own name, not on the modules it imports.
match: "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"
assertion: Use the module's name instead of index.ts for internal modules,
  including barrels and the core module of a directory representing that module.
  Keep a directory's core module inside that directory, such as Cli/Cli.ts or
  auth/auth.ts. Reserve index.ts for entrypoints exposed as package exports and
  for the tables/index.ts barrel of database table definitions (see
  separate-table-definitions-with-barrel); being a barrel alone does not
  otherwise justify index.ts. Whether a file is a package entry point is stated
  by the prelude's report, derived from its nearest package.json; an
  index.ts it reports as an entry point complies. Update imports when renaming.
purpose: Make module identity and ownership visible in filenames and import
  paths while preserving package export entrypoints.
prelude:
  - Find whether this file is an entry point in its nearest package.json.
---

```diff
-import { Cli } from "./Cli/index.ts"
+import { Cli } from "./Cli/Cli.ts"
```

A module directory owns its entry file: use auth/auth.ts rather than a sibling auth.ts.

When the directory already has a core module of that name, that module also hosts the barrel's re-exports, as Profile/Profile.ts does with `export * from "./ProfileName.ts"`. If a re-exported module imports the core module's runtime values, break the cycle first, for example with `S.suspend`.

Importing an index.ts does not make the importer a violation: `import { Server } from "../../../mcp/index.ts"` in Cli/commands/mcp/mcp.ts complies, since mcp.ts is module-named and mcp/index.ts is a package export.
