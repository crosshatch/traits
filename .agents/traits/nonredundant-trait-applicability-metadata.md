---
name: nonredundant-trait-applicability-metadata
purpose: Make applicability decisions easier by separating the subject from genuinely additional scope and exceptions.
subject: Trait subject and applicability descriptions.
requirement: >
  Keep trait subject and applicability descriptions complementary. Subject
  identifies what to assess; applicability adds circumstances, language or file
  restrictions, and independent exceptions without repeating the subject or
  restating its negation. Omit applicability when it adds no restriction.
applicability: Authoring or reviewing trait subject and applicability descriptions.
---
```diff
-subject: Imports from local project modules.
-applicability: Not imports from external packages.
+subject: Imports from local project modules.
```
