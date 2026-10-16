---
id: 7e8bb6e7-d4c1-4ec5-80a7-8b614881c3de
name: effect-public-barrel-imports
---

Prefer Effect’s public namespace barrel imports when they expose the required module, for example import type { SqlError } from 'effect/sql' and use SqlError.SqlError in type annotations, rather than importing the class from 'effect/sql/SqlError'. Use a subpath when the public barrel does not expose what is needed.
