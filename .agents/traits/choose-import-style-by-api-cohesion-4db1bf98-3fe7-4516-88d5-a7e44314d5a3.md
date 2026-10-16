---
id: 4db1bf98-3fe7-4516-88d5-a7e44314d5a3
name: choose-import-style-by-api-cohesion
mime:
  - text/typescript
  - text/tsx
  - text/javascript
  - text/jsx
when: choosing between named and namespace imports
---
Prefer namespace imports when multiple members form a cohesive module API and qualification clarifies their origin or replaces module-name aliases—for example, Yaml.parse, Yaml.stringify, and Yaml.YAMLParseError. Otherwise preserve named imports from external dependencies, including independent exports from umbrella packages such as effect. Do not introduce namespaces solely because of member counts or alias prefixes; choose based on API cohesion and call-site clarity, not whether the module is external.