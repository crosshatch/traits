---
mime:
  - text/tsx
  - text/jsx
when: removing UI elements that are unnecessary in a particular state
name: omit-unneeded-jsx-instead-of-css-hiding
---

```diff
-<div className={unneeded ? "hidden" : undefined}>…</div>
+{!unneeded && <div>…</div>}
```

---
When a React element is unnecessary in a particular UI state, omit it through conditional JSX rather than rendering it and hiding it with CSS. Keep CSS hiding when retaining the mounted element is required for behavior or layout.