---
name: nonredundant-trait-applicability-metadata
when: authoring or reviewing trait applicability metadata.
---

```diff
-when: importing from local project modules
-skip: importing from external packages
+when: importing from local project modules
```

---
Keep trait applicability metadata nonredundant: when defines positive semantic scope, and mime restricts file types or languages. Include skip only for an independent exception inside that scope; omit it when it merely negates or repeats when or mime. Leave unnecessary optional metadata fields absent.
