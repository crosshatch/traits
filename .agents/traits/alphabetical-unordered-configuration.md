---
name: alphabetical-unordered-configuration
subject: Configuration lists and fields whose ordering has no semantic
  significance, in TypeScript, JavaScript, JSON, YAML, or TOML files.
assertion: 'Prefer alphabetical ordering for miscellaneous configuration lists
  and fields when their order has no semantic significance: projects:
  ["oxlints/vite.config.ts", "traits.sh/vite.config.ts",
  "traits/vite.config.ts"]. Preserve intentional dependency, execution,
  precedence, and user-facing order rather than sorting those blindly.
  Alphabetical means the order of the entries as written, compared character by
  character, including leading punctuation such as ./ and @; a list already in
  that order complies.'
purpose: Make unordered configuration easy to scan and reduce incidental diff
  churn without changing execution semantics.
---

```diff
-projects: ["traits/vite.config.ts", "oxlints/vite.config.ts"]
+projects: ["oxlints/vite.config.ts", "traits/vite.config.ts"]
```

Not a violation: `"references": [{ "path": "./@traits/typescript" }, { "path": "./traits" }, { "path": "./traits.sh" }, { "path": "./tsconfig.node.json" }]`, which is already in order: `@` sorts before letters, and `./traits` before `./traits.sh`.
