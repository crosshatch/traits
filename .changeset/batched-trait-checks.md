---
"traits": patch
---

Batch independent trait assessments against shared source chunks to reduce
decision-model requests and repeated source tokens. Bound batches by question
count and UTF-8 size while preserving UUID mapping, per-trait results, and
semaphore-limited HTTP concurrency. Fail oversized inputs and incomplete
provider answers explicitly instead of truncating or silently skipping checks.
