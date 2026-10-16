---
"tracewick": patch
---

Use Effect's JsonObject schema/type directly for generic query results, rename
the query envelope to TelemetryQueryRequest and its description map to
operationDescriptions, and flatten Effect composition. Keep metadata versions
required and preserve actionable read errors instead of swallowing them as
missing metadata.
