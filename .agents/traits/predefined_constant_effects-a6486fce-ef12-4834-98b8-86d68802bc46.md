---
id: a6486fce-ef12-4834-98b8-86d68802bc46
name: predefined_constant_effects
when: constructing successful constant Effects with predefined equivalents.
mime: [text/typescript, text/tsx]
---
Use Effect’s predefined constant effects rather than constructing equivalent successful effects: Effect.undefined, not Effect.succeed(undefined); Effect.void, not Effect.succeed(void 0). Apply this when a dedicated constant with the same semantics exists.
