---
name: inline-small-single-use-helpers
subject: Small named helper functions, including exported ones and React atom logic.
  Excludes trivial error-constructor forwarding helpers, named constant values,
  and helpers used only within React component render or event handlers, such as
  a JSX row callback. Applies to TypeScript, TSX, JavaScript, and JSX.
assertion: "Prefer inlining small single-use helper logic into the operation that consumes
  it instead of introducing a separately named helper. A helper is single-use
  when exactly one call or reference site in the codebase uses it. Count each
  site separately: two calls in one file, or three calls in one other file, are
  not single-use. An exported helper whose one use is in another file is
  single-use; inline it there. Uses in other files, when supplied as context,
  decide this. Re-exports are not uses, and a helper with no uses is unused
  rather than single-use. Small means a few lines,
  such as a one-line transformation; multi-step logic, logic with its own nested
  helpers, and code longer than about ten lines are not small. Out of scope are exports of entry modules
  that tools load by path or dynamic import, such as a server-side rendering
  module, and helpers that are public API: exported by a package entry point
  directly or through any chain of re-exports. Extract a helper when reused,
  when naming materially improves readability, or when it defines a meaningful
  domain or API boundary; a separate module alone is not such a boundary. In
  React, inline atom logic into its atom definition or Effect operation; never
  inline into component render or event handlers."
purpose: Keep local behavior easy to follow without unnecessary helper indirection.
enrichments:
  - "@traits/typescript/references"
---
For example, place theme initialization directly inside its atom definition.

```diff
-const getName = (item) => item.name // Trivial single-use helper.
-const names = Array.map(items, getName)
+const names = Array.map(items, (item) => item.name)
```
Violation: `export const normalizeTag = (tag: string) => tag.trim().toLowerCase()` in `tags.ts`, used only by `createPost.ts`. Not a violation: the same helper used by three operations.

Not a violation: `export const render = () => renderToString(<App />)` in a server-side rendering entry module that vite.config.ts loads with `ssrLoadModule`.
