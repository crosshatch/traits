---
id: 8d2e3980-5dc8-4c59-89b7-7873d1363905
name: yield-before-call-arguments
when: sequencing Effect generator results and passing them to transformations or function calls.
mime: [text/typescript, text/tsx]
---
Avoid yield* expressions inside function-call arguments in Effect generators. Apply the enclosing transformation to the effect and yield the result: provider = yield* load.pipe(Effect.map((value) => ConfigProvider.orElse(provider, value))), not provider = ConfigProvider.orElse(provider, yield* load). If composing is unclear, yield into a local variable first.
