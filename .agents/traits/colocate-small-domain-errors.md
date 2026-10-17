---
name: colocate-small-domain-errors
---

```diff
-// Parse.ts
-import { InvalidDocument } from "./InvalidDocument.ts"
+// Parse.ts: the small error belongs to this operation.
+export class InvalidDocument extends S.TaggedError<InvalidDocument>()("InvalidDocument", { path: S.String }) {}
```

---
Define small domain-specific error types alongside the domain operations that produce them rather than creating standalone error modules, unless separate ownership or dependency constraints justify a separate module.
