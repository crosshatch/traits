---
"traits": patch
---

Return compact, file-grouped check reports with shared trait definitions, source
chunks, and full-file snapshot revisions. The check_traits success response is
now { traits, files } instead of a flat evaluation array. Assessments and review
coverage are preserved; the raw TraitEvaluation API remains unchanged.
