---
id: 6edef001-f09f-4783-8d1a-8fd3b526ecf6
name: unwrap_presence_only_options
when: using Option only to test presence and access the contained value.
mime: [text/typescript, text/tsx]
---
When an Option is used only to check presence and access its value, unwrap it with Option.getOrUndefined rather than repeatedly using Option.isSome and .value: yield* effect.pipe(Effect.map(Option.getOrUndefined)). Access the value directly and use explicit undefined checks where strict-boolean linting requires them. Retain Option when its combinators or distinction between Some(undefined) and None are needed.
