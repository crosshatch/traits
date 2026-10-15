---
id: 948dae7b-b9c8-4e72-9b0a-9b93b71d22fd
name: direct_property_access_in_parameters
activation: When declaring function, callback, or generator parameters that receive objects.
mime: [text/typescript, text/tsx, text/javascript, text/jsx]
---
Use direct property access rather than object destructuring in function parameters, including arrow callbacks, ordinary functions, and generator/Effect handlers: `(v) => v.id`, not `({ id }) => id`; `function* (params) { yield* check(params.files) }`, not `function* ({ files }) { yield* check(files) }`. This applies regardless of the function body's complexity, not only to property selectors. Local destructuring inside a function body is unaffected.
