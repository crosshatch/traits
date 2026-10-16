---
id: 4e1d575c-d906-4941-b654-f683fb63bdc3
name: yield-effectable-errors-directly
when: returning or yielding an Effect error value that is itself effectable.
mime: [text/typescript, text/tsx]
---
When an Effect error value is itself effectable, return or yield it directly instead of wrapping it with Effect.fail: return error, not return Effect.fail(error). Keep Effect.fail for error values that are not effectable.
