---
name: domain-types-for-complete-record-storage
when: designing or implementing storage operations that create or replace complete domain records.
mime: [text/typescript, text/tsx]
---

```diff
-const add = (name: TraitName, body: string) => persist({ name, body })
+const add = (trait: Trait) => persist(trait)
```

---
For storage operations that create or replace complete domain records, accept the existing domain type instead of separate per-field parameters or a manually duplicated object type. Persist the complete record without dropping optional metadata or extension fields.
