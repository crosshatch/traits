---
"traits": patch
---

Support YAML frontmatter in traits, exposing when, MIME, and skip metadata with
unique descriptive kebab-case names as identities. Use name-only Markdown
filenames in the filesystem adapter; the storage service uses names
independently of its backend and preserves full trait metadata.

Independently verify full coverage against saved bodies and applicability
metadata before returning Covered. Route coverage gaps through approval-gated
reconciliation and preserve metadata in generated replacements.
