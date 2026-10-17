---
name: static-imports-first
when: adding or reorganizing static module imports.
mime: [text/typescript, text/tsx, text/javascript, text/jsx]
---
Place all static import declarations at the top of a module, before executable statements and other declarations: import { Layer } from "effect" before export default ..., never after it. Dynamic import() expressions may remain where needed.
