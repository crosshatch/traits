---
name: colocate-small-domain-errors
purpose: Keep small error definitions close to their meaning and avoid unnecessary module fragmentation.
subject: Small domain-specific error types.
requirement: Define small domain-specific error types alongside the domain
  operations that produce them rather than creating standalone error modules,
  unless separate ownership or dependency constraints justify a separate module.
---
```diff
-// Parse.ts
-import { InvalidDocument } from "./InvalidDocument.ts"
+// Parse.ts: the small error belongs to this operation.
+export class InvalidDocument extends S.TaggedError<InvalidDocument>()("InvalidDocument", { path: S.String }) {}
```
