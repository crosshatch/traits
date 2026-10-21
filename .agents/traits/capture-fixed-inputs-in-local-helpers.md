---
name: capture-fixed-inputs-in-local-helpers
subject: Helpers used only within one enclosing operation.
requirement: Prefer defining the helper locally and capturing fixed ordinary
  inputs rather than hoisting it and passing the same unchanged inputs at every
  call. Retain broader scope when reuse, a meaningful API boundary, or
  construction costs justify it.
applicability: Applies to ordinary inputs, not Effect context services.
purpose: Keep helper ownership clear and avoid redundant argument plumbing.
---
