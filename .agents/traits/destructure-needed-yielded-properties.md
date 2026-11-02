---
name: destructure-needed-yielded-properties
subject: Local bindings of object results yielded from Effects or context services.
requirement: Destructure the needed properties directly from the yielded result
  instead of introducing an intermediate object binding that is only accessed or
  immediately destructured. Retain the object when needed as a whole, and
  preserve access timing and receiver binding for getters, live properties, and
  receiver-sensitive methods. This concerns local bindings, not function
  parameters.
purpose: Make dependencies explicit at the binding site without unnecessary
  intermediate names.
---
```diff
-const paths = yield* WorkspacePaths
-const lockPath = paths.lock
+const { lock } = yield* WorkspacePaths
```