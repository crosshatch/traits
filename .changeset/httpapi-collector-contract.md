---
"tracewick": patch
---

Model collector routes with Effect HttpApi and expose the shared API definition
for typed clients. Replace manual path dispatch and JSON request parsing with
HttpApiBuilder handlers while preserving OTLP encodings, run attribution,
loopback protection and bounded gzip payload handling.
