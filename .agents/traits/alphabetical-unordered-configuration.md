---
name: alphabetical-unordered-configuration
when: editing configuration lists or fields whose ordering has no semantic significance.
mime: [text/typescript, text/javascript, application/json, application/yaml, application/toml]
---

```diff
-projects: ["traits/vite.config.ts", "rules/vite.config.ts"]
+projects: ["rules/vite.config.ts", "traits/vite.config.ts"]
```

---
Prefer alphabetical ordering for miscellaneous configuration lists and fields when their order has no semantic significance: projects: ["rules/vite.config.ts", "traits.sh/vite.config.ts", "traits/vite.config.ts"]. Preserve intentional dependency, execution, precedence, and user-facing order rather than sorting those blindly.
