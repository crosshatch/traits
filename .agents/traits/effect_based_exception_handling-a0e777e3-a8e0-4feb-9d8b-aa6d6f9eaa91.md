---
id: a0e777e3-a8e0-4feb-9d8b-aa6d6f9eaa91
name: effect_based_exception_handling
activation: When handling throwable synchronous operations or Promise failures in application code.
mime: [text/typescript, text/tsx, text/javascript, text/jsx]
---
Do not use JavaScript try/catch in application code. Model throwable synchronous operations with Effect.try and Promise failures with the appropriate Effect Promise adapter, then recover with Effect error-handling combinators such as catchTags. Handle Effect.try’s actual default error tag explicitly: UnknownError in stable Effect 4.0 (rather than the older UnknownException name). In React, put such actions in Atom.fn backed by a named Effect.fn, not inline component handlers or Atom.fnSync. Preserve intentional fallback behavior and let unhandled operational errors propagate.
