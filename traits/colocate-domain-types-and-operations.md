---
name: colocate-domain-types-and-operations
subject: Core domain types and the operations that act on them.
match: "**/*.{ts,tsx,mts,cts}"
assertion: "Keep each core domain type in its own module and export the
  functions that operate on that type from the same module: TraitExpression.ts
  exports both TraitExpression and check. This includes a function that builds
  the type from another domain type, which is named for its source:
  SourceIdentity.ts exports fromInputSource, rather than the module that calls
  it defining a private sourceIdentity helper. Consumers such as tool adapters
  should import these definitions rather than defining domain types and their
  operations inline."
purpose: Make domain behavior discoverable beside its data model and keep
  adapters from owning domain logic.
---

```diff
-import { TraitExpression } from "./TraitExpression.ts"
-import { check } from "./checkTraitExpression.ts"
+import { TraitExpression, check } from "./TraitExpression.ts"
```

Not a violation: a helper module that declares a type only for its own options or parameters, such as a `RenderOptions` interface beside `render`; that is not a core domain type, and nothing else imports it.

A helper that converts one domain type into another belongs to the module of the type it returns, named `from<Source>` and called through that module, such as `ChangeIdentity.fromChange(change)`:

```diff
-// Check.ts
-const sourceIdentity = (source: InputSource) => /* digests source.text into a SourceIdentity */
+// SourceIdentity.ts
+export const fromInputSource = (source: InputSource) => /* digests source.text into a SourceIdentity */
```

Not a violation: a helper that serves only its own module's workflow rather than the type in general, such as one that words an operation-specific failure as an `Explanation`, a closure that captures the enclosing operation's local values, or a direct call to a schema's own `make` constructor.
