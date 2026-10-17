---
"traits": patch
---

Use unique trait names as canonical identity instead of UUIDs. Store traits as
`<name>.md` without an `id` frontmatter field, select focused reviews with
`traitNames`, and match ignore directives by exact name. Reject duplicate names
and protect unaffected traits during reconciliation. See MIGRATE_TRAITS.md for
migrating existing collections and references.
