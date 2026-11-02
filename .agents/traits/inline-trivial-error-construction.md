---
name: inline-trivial-error-construction
subject: Error-construction callbacks in catch, mapError, and similar
  failure-handling sites.
requirement: Construct one-expression errors directly at the callback or failure
  site instead of extracting a helper whose only behavior is forwarding a cause
  into an error constructor, even when the expression repeats. Retain helpers
  that implement meaningful validation, recovery, shared policy, or a domain/API
  boundary beyond constructor forwarding.
applicability: Applies even when naming a constructor-forwarding helper would
  improve readability.
purpose: Keep error construction visible where the failure is handled without
  trivial helper indirection.
---
```diff
-const failure = (cause: unknown) => LockError.make({ cause })
-effect.pipe(Effect.mapError(failure))
+effect.pipe(Effect.mapError((cause) => LockError.make({ cause })))
```