---
name: avoid-unnecessary-operation-error-wrappers
subject: Introduction of custom operation-specific error wrappers in Effect code.
requirement: Do not introduce custom operation-specific error wrappers where
  existing errors suffice.
applicability: Applies when choosing error contracts for recovery or external boundaries.
purpose: Avoid redundant error abstractions that obscure useful existing failure
  information.
---
An operation-specific wrapper is appropriate when needed for recovery or a meaningful external boundary; its mere availability does not justify replacing adequate existing errors.