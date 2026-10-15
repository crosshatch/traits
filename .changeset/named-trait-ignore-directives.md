---
"traits": patch
---

Allow file-scoped trait ignore directives to match either a UUID or an exact
trait name. UUIDs target one stable record, while names match all same-name
traits. Use a name-based exception in the CLI launcher and document rename
behavior, duplicate names, and migration guidance.
