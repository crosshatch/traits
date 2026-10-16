---
id: 97ff7ffa-ccd0-44e9-bdf1-d6b7b54f6fad
name: canonical-builtin-effect-imports
---

Import Effect modules that share JavaScript builtin names under their canonical names, without aliases such as String as Text or Number as Num. When a native builtin is shadowed by an Effect import, access it through globalThis (for example, globalThis.String). This rule concerns builtin-name collisions; non-builtin shorthand such as Schema as S is allowed.
