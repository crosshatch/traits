---
id: 6fa56234-af45-4708-9b48-0b8fff1150bf
name: alphabetical_unordered_configuration
when: editing configuration lists or fields whose ordering has no semantic significance.
mime: [text/typescript, text/javascript, application/json, application/yaml, application/toml]
---
Prefer alphabetical ordering for miscellaneous configuration lists and fields when their order has no semantic significance: projects: ["rules/vite.config.ts", "traits.sh/vite.config.ts", "traits/vite.config.ts"]. Preserve intentional dependency, execution, precedence, and user-facing order rather than sorting those blindly.
