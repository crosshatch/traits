---
"traits": patch
---

Support YAML frontmatter in traits, exposing activation, MIME, and skip metadata
with descriptive snake_case names and stable crypto-random UUID identities. Use
name-UUID Markdown filenames only in the filesystem adapter; the storage service
uses UUIDs independently of its backend and preserves full trait metadata.

Independently verify full coverage against saved bodies and applicability
metadata before returning Covered. Route coverage gaps through approval-gated
reconciliation and preserve metadata in generated replacements.
