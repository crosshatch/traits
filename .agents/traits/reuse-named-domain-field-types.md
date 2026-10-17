---
name: reuse-named-domain-field-types
when: referencing a model field's type or schema where a dedicated domain type already exists.
mime: [text/typescript, text/tsx]
---

```diff
-const get = (name: Trait["name"]) => store.get(name)
+const get = (name: TraitName) => store.get(name)
```

---
When an existing named domain type represents a model field, reference that type directly rather than extracting it with indexed access: TraitName instead of Trait["name"]. Reuse its schema value for decoding as well. Keep indexed access when no suitable named domain type exists.
