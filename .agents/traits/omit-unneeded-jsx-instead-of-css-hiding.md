---
name: omit-unneeded-jsx-instead-of-css-hiding
subject: React components in JSX or TSX files that show or hide elements
  depending on UI state, whether through conditional rendering or through CSS
  such as hidden classes, display or visibility styles, or the hidden
  attribute.
assertion: When a React element is unnecessary in a particular UI state, omit it
  through conditional JSX rather than rendering it and hiding it with CSS. Keep
  CSS hiding when retaining the mounted element is required for behavior or
  layout.
purpose: Avoid rendering unnecessary UI while preserving elements needed for
  behavior or layout.
---

```diff
-<div className={unneeded ? "hidden" : undefined}>…</div>
+{!unneeded && <div>…</div>}
```
