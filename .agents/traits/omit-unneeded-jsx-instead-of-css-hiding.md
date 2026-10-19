---
name: omit-unneeded-jsx-instead-of-css-hiding
subject: React elements that are unnecessary in a particular UI state.
requirement: When a React element is unnecessary in a particular UI state, omit it through conditional JSX rather than rendering it and hiding it with CSS. Keep CSS hiding when retaining the mounted element is required for behavior or layout.
applicability: JSX and TSX files when removing UI elements that are unnecessary in a particular state.
purpose: Avoid rendering unnecessary UI while preserving elements needed for behavior or layout.
---

```diff
-<div className={unneeded ? "hidden" : undefined}>…</div>
+{!unneeded && <div>…</div>}
```
