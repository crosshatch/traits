---
id: 5b38b304-91f7-485c-b7be-37564a18cc3c
name: flat_transformation_pipelines
activation: When composing successive transformations or Effect.fn transformation arguments.
mime: [text/typescript, text/tsx]
---
Use `.pipe(...)` to keep successive transformations flat and readable in execution order, rather than nesting transformation calls around an expression. For example, prefer `Effect.gen(...).pipe(Layer.unwrap, Layer.provide(dependencies))` over `Layer.unwrap(Effect.gen(...)).pipe(Layer.provide(dependencies))`. Keep successive transformations in the same pipe where practical. For `Effect.fn` and `Effect.fnUntraced`, use their transformation arguments as the equivalent flat composition style.
