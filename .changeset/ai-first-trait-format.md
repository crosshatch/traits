---
"traits": patch
---

Replace body-centric traits with required subject, requirement, and purpose
fields, optional natural-language applicability and guidance, and optional
Markdown context. Reject unsupported frontmatter instead of silently discarding
it.

This changes the stored format and SDK/MCP contracts. Explicitly migrate older
collections to the new fields and reconnect the MCP server. Parse errors provide
migration guidance without rewriting files. `derive_trait` now accepts a
complete trait object as `proposedTrait`; `check_traits` optionally accepts
invocation circumstances.
