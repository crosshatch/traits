---
name: minimal-high-value-tests-and-type-first-verification
purpose: Preserve development speed while concentrating verification on important risks that static types cannot establish.
subject: Test coverage and verification choices during development.
requirement: Prioritize development velocity and strong static types. Keep only
  concise tests that protect important behavior types cannot establish; avoid
  repetitive assertions, redundant suites, and broad end-to-end workflow tests.
  For routine edits, prefer formatting, lint, and type checks and run only
  relevant tests when warranted. When model-dependent behavior materially needs
  verification, use a small, explicitly opt-in real-model check with meaningful
  inputs and expected outcomes, not canned model answers. Use mocks only for
  important independent deterministic utility, protocol, or failure handling; do
  not treat mock-driven outcomes as evidence of model quality.
---
