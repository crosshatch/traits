---
name: inline-small-single-use-helpers
subject: Small named helpers, including exported ones and React atom logic,
  other than trivial error-constructor forwarding helpers. Applies to
  TypeScript, TSX, JavaScript, and JSX.
assertion: Prefer inlining small single-use helper logic into the operation that consumes
  it instead of introducing a separately named helper. A helper is single-use
  when exactly one site in the codebase calls or references it, including an
  exported helper whose only use is in one other file; inline it into that
  consumer. Uses in other files, when supplied as context, decide this. Re-
  exports are not uses, and a helper with no uses is unused rather than single-
  use. Out of scope are exports of entry modules that tools load by path or
  dynamic import, such as a server-side rendering module, and helpers a barrel or package entry point re-exports, by name or with export *,
  as public API. Extract a helper when reused,
  when naming materially improves readability, or when it defines a meaningful
  domain or API boundary; a separate module alone is not such a boundary. In
  React, inline into the relevant atom or Effect operation, not into component
  render or event handlers.
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
