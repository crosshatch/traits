---
"traits": patch
---

Hydrate the trait index after watcher readiness to avoid a duplicate startup
scan. Cache exact unchanged evaluations with bounded capacity and expiry, and
isolate each tool invocation in its own root trace.
