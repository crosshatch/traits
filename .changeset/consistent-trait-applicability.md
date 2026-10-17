---
"traits": patch
---

Accept caller-supplied applicability metadata without an extra model call.
Include it in relationship checks and approval previews, and prevent stale
applicability from surviving clarification or reconciliation.

Group domain applicability and extension metadata into explicit objects. The
derive tool accepts a complete applicability object; Markdown encoding and
decoding handle flat frontmatter at the storage boundary.
