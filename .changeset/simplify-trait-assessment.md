---
"traits": patch
---

Simplify assessment result construction by removing per-result Effects and
spans. Keep batch-level tracing, assessment output, request limits, and
concurrency unchanged. Remove the unused single-trait evaluate helper; use
evaluateAll with a one-element array.
