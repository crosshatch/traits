---
name: predefined-constant-effects
when: constructing successful constant Effects with predefined equivalents.
mime: [text/typescript, text/tsx]
---
Use Effect’s predefined constant effects rather than constructing equivalent successful effects: Effect.undefined, not Effect.succeed(undefined); Effect.void, not Effect.succeed(void 0). Apply this when a dedicated constant with the same semantics exists.
