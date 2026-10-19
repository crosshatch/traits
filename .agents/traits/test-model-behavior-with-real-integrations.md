---
name: test-model-behavior-with-real-integrations
purpose: Obtain evidence of actual model behavior rather than mistaking predetermined mock answers for model quality.
subject: Tests of model-dependent behavior.
requirement: Test model-dependent behavior with real-model integration tests
  using meaningful inputs and expected outcomes, rather than mocked model
  answers that predetermine the behavior under test. Use mocks only when they
  help validate important independent deterministic behavior, such as utility
  logic, protocol handling, or failure handling; do not treat mock-driven
  outcomes as evidence of model quality.
---
