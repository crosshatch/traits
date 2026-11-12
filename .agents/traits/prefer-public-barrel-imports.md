---
name: prefer-public-barrel-imports
subject: Import specifiers that reach into another package's internal modules
  instead of one of its entry points, such as a relative path leaving the
  importing file's package or a deep path like pkg/dist/x.js or pkg/src/x.ts.
  Bare package names and the subpaths a package exports, and relative imports
  within the importing file's own package, are out of scope.
assertion: Prefer importing through the appropriate public package or subpackage
  barrel instead of a deeper module path when that barrel exports the needed
  API. Use namespace-qualified types when the barrel exports a module namespace
  rather than the type directly. Retain deeper imports when necessary for
  correctness or to avoid material runtime or bundling costs.
purpose: Keep imports concise and aligned with the package’s public API boundaries.
---
Violation: `import { WorkspaceRoot } from "../../traits/local/WorkspaceRoot.ts"` in another workspace package, when the `traits/local` export re-exports it; import from `"traits/local"`.

Not a violation: `import { WorkspaceRoot } from "traits/local"`, `import { Atom } from "effect/reactivity"` (a public subpath barrel), or `import * as Input from "../util/Input.ts"` within the same package.

In this workspace each package is a top-level directory with its own package.json (`traits/`, `@traits/typescript/`, `traits.sh/`). A relative import leaves its package only when it climbs above that directory, so `../../../Report/Report.ts` or `../../../mcp/index.ts` from `traits/Cli/commands/check/check.ts` stays within `traits` and is out of scope, however many `../` it has.
