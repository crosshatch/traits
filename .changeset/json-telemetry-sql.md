---
"traits": patch
---

Simplify local telemetry to JSON-only OTLP ingestion and individual span/log
rows with complete record and resource/scope JSON. Replace inspection filters
with `traits query '<sql>'`, returning JSON rows. Remove protobuf decoding and
descriptor generation. Retain legacy export batches without migrating them.
