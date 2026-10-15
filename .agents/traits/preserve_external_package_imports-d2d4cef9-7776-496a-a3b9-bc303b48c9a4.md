---
id: d2d4cef9-7776-496a-a3b9-bc303b48c9a4
name: preserve_external_package_imports
when: considering a namespace-import rewrite of named imports from an external dependency package because of member counts or alias prefixes.
mime: [text/typescript, text/tsx, text/javascript, text/jsx]
---
Keep named imports for external dependency packages, including "effect" and parser/serializer imports from "yaml", even when importing more than two exports or using module-name-prefixed aliases. Do not replace them with namespace imports merely to satisfy a member-count or alias-prefix preference.
