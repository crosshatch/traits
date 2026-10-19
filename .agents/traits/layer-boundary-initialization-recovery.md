---
name: layer-boundary-initialization-recovery
subject: Recoverable Effect application initialization failures.
requirement: For recoverable Effect application initialization failures, prefer
  recovery at the existing Layer boundary with a minimal degraded service over
  adding deferred runtimes or per-operation initialization wrappers when fixing
  setup and restarting is sufficient.
---
```diff
-// Add a deferred runtime and initialization wrappers to every handler.
+configuredToolkit.pipe(Layer.catchCause(configurationErrorToolkit))
```
