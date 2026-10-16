---
id: 133f18fd-7707-41dc-90c9-72959273197c
name: structured-diagnostic-errors
---

Preserve Effect’s built-in error types when they already provide case-specific structured context; do not wrap them merely for presentation. For distinct application failure cases, use narrow tagged custom errors with typed, case-specific diagnostic fields rather than a generic message-only error. Include relevant paths, IDs, expected/observed values, limits, request/response details and causes. Human-readable messages supplement those fields. At transport boundaries preserve error tags, properties and causes instead of reducing failures to strings.
