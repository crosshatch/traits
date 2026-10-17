---
name: direct-schema-construction-with-explicit-ids
---

```diff
-const record = createRecord(body) // Wrapper only generates an ID and forwards fields.
+const record = Record.make({ id: newId(), body })
```

---
Construct domain records directly with their schema constructors instead of adding a wrapper whose only behavior is generating an identifier and forwarding fields. Generate new IDs explicitly at actual creation sites, and preserve existing IDs when constructing updates or migrating records.
