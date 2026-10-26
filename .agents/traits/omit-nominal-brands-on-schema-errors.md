---
name: omit-nominal-brands-on-schema-errors
subject: Effect Schema error class signatures.
requirement: Omit the explicit nominal-brand type argument on Schema error
  classes rather than adding it solely to satisfy schema-class-missing-brand
  linting.
purpose: Keep error signatures concise without unnecessary type-level complexity.
---
