---
id: 632801b2-7060-435d-8e87-4dfd18700420
name: pure-synchronous-helpers
---

Prefer plain, non-effectful functions for synchronous computations and helpers unless the consuming interface explicitly requires an Effect type. Use Effect.sync only to satisfy such an interface, rather than making a helper Effectful merely because it is called from Effect code. At actual side-effect and acquire/release boundaries, preserve deferred execution.
