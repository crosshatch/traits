---
name: structural-equality-for-composite-keys
when: composite keys in Effect collections, caches, or Atom.family need content-based equality.
mime: [text/typescript, text/tsx]
---
When a composite value is used as a key in an Effect collection, cache, or Atom.family and should match by its contents across independently created instances, use Effect-compatible structural equality and hashing, such as Data.Class, rather than plain object identity or hand-written comparison/stringification. For example, new CopyInput({ id, code }) should reuse the same family atom for equal id/code values. Keep primitive keys or intentional identity semantics when appropriate; do not wrap ordinary objects merely because they contain data.
