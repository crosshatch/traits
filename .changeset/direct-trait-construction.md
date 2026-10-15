---
"traits": patch
---

Remove the UUID-generating make helper in favor of direct schema construction.
Allocate IDs explicitly in trait creation and reconciliation, and preserve
existing IDs when constructing updates or migrating records.
