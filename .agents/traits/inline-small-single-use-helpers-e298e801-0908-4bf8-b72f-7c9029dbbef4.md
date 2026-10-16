---
id: e298e801-0908-4bf8-b72f-7c9029dbbef4
name: inline-small-single-use-helpers
when: introducing or reviewing small single-use helpers, including React atom logic.
mime: [text/typescript, text/tsx, text/javascript, text/jsx]
skip: When helper extraction materially improves readability through naming or defines a meaningful domain or API boundary.
---
Prefer inlining small single-use helper logic into the operation that consumes it instead of introducing a separately named helper, such as placing theme initialization directly inside its atom definition. Extract a helper when reused, when naming materially improves readability, or when it defines a meaningful domain/API boundary. In React, inline into the relevant atom or Effect operation, not into component render or event handlers.
