---
"traits": patch
---

Track persisted chunk/trait assessments and reconcile missing coverage against
an explicit project scope. Changed code is assessed against all traits; new and
revised traits are assessed against all files after saving. Caller filters no
longer narrow configured coverage. Require explicit approval for the cold
baseline cost, and retain cached findings without treating uncertainty or errors
as completed coverage.
