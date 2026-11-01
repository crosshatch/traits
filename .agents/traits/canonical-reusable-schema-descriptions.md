---
name: canonical-reusable-schema-descriptions
subject: Description annotations on reusable Effect schemas and their use as
  object fields.
requirement: Describe a reusable value’s intrinsic meaning once with .annotate({
  description }) on its schema. Reuse that schema directly when field semantics
  are unchanged, rather than repeating or replacing its description. Use
  .annotateKey({ description }) for genuinely contextual property documentation.
  Override the schema description at a use site only when intentionally
  replacing its description for that use, preserving relevant constraints and
  semantics. Keep field TSDoc aligned with the inherited or contextual
  description.
purpose: Preserve canonical domain documentation and prevent redundant or less
  informative field annotations from obscuring it.
---
For example, a reusable execution-scope schema can explain each scope and that unrelated work is unaffected; a reason field with those same semantics uses reason: ExecutionScope directly. Property-specific context belongs in annotateKey rather than a replacement annotate description. This complements documentation synchronization by specifying where descriptions belong.