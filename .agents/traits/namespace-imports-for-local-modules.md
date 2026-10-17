---
name: namespace-imports-for-local-modules
when: importing more than two exports from a local project module or giving multiple local exports aliases with a shared module-name prefix.
mime: [text/typescript, text/tsx, text/javascript, text/jsx]
---
For local project modules, prefer namespace imports and qualified member access when importing more than two exports or when multiple exports would otherwise have aliases sharing a module-name prefix. For example, use import * as Trait from "./Trait.ts" with Trait.parse, Trait.serialize, Trait.Trait, and Trait.TraitName.
