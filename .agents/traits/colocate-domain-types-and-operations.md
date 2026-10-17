---
name: colocate-domain-types-and-operations
when: introducing or organizing core domain types and their operations.
mime: text/typescript
---

```diff
-import { TraitExpression } from "./TraitExpression.ts"
-import { check } from "./checkTraitExpression.ts"
+import { TraitExpression, check } from "./TraitExpression.ts"
```

---
Keep each core domain type in its own module and export the functions that operate on that type from the same module: TraitExpression.ts exports both TraitExpression and check. Consumers such as tool adapters should import these definitions rather than defining domain types and their operations inline.
