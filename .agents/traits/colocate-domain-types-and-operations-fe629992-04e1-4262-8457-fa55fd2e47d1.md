---
id: fe629992-04e1-4262-8457-fa55fd2e47d1
name: colocate-domain-types-and-operations
when: introducing or organizing core domain types and their operations.
mime: text/typescript
---
Keep each core domain type in its own module and export its operations from that module; for example, TraitExpression.ts exports TraitExpression and check. Consumers such as tool adapters should import these definitions rather than define domain types and their operations inline, except for trivial one-expression helper wrappers that qualify for inlining.
