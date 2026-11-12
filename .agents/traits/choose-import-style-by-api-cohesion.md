---
name: choose-import-style-by-api-cohesion
subject: Imports from external dependencies (npm/jsr packages and their
  subpaths, not relative project paths) in TypeScript, TSX, JavaScript, or JSX
  files. Imports from local project modules are governed by
  namespace-imports-for-local-modules and are out of scope.
assertion: Prefer namespace imports when multiple members of an external
  package form a cohesive module API and qualification clarifies their origin
  or replaces module-name aliases—for example, Yaml.parse, Yaml.stringify, and
  Yaml.YAMLParseError. Otherwise preserve named imports, including independent
  exports from umbrella packages such as effect. Aliasing a namespace export of
  an umbrella package, such as `import { Schema as S } from "effect"`, is the
  preferred style, not a module-name alias, and must not be converted to a
  namespace import. Renaming two or more members of one package with aliases
  that embed the package name, such as parse as parseToml and stringify as
  stringifyToml, is a violation; use a namespace import such as Toml.parse.
  Do not introduce namespaces solely because of member counts; otherwise choose
  based on API cohesion and call-site clarity.
purpose: Clarify API ownership without adding namespace noise to unrelated exports.
---
Violation: functions of one cohesive package API renamed with module-name aliases.

```diff
-import { parse as parseYaml, stringify as stringifyYaml } from "yaml"
+import * as Yaml from "yaml"
-import { parse as parseToml, stringify as stringifyToml } from "smol-toml"
+import * as Toml from "smol-toml"
```

Correct:

```ts
// Shortening alias of a namespace export from an umbrella package.
import { Schema as S } from "effect"
// Independent exports from an umbrella package.
import { Array, Effect, Option, pipe } from "effect"
```
