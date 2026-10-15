---
id: fe629992-04e1-4262-8457-fa55fd2e47d1
name: colocate_domain_types_and_operations
when: introducing or organizing core domain types and their operations.
mime: text/typescript
---
Keep each core domain type in its own module and export the functions that operate on that type from the same module: TraitExpression.ts exports both TraitExpression and check. Consumers such as tool adapters should import these definitions rather than defining domain types and their operations inline.
