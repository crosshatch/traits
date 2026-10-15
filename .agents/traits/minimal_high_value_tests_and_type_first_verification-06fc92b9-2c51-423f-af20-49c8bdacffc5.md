---
id: 06fc92b9-2c51-423f-af20-49c8bdacffc5
name: minimal_high_value_tests_and_type_first_verification
---
Prioritize development velocity and strong static types. Keep only concise tests that protect important behavior types cannot establish; avoid repetitive assertions, redundant suites, and broad end-to-end workflow tests. For routine edits, prefer formatting, lint, and type checks and run only relevant tests when warranted. When model-dependent behavior materially needs verification, use a small, explicitly opt-in real-model check with meaningful inputs and expected outcomes, not canned model answers. Use mocks only for important independent deterministic utility, protocol, or failure handling; do not treat mock-driven outcomes as evidence of model quality.