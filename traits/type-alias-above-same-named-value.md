---
name: type-alias-above-same-named-value
subject: A type alias that shares its name with an exported value and is derived
  from it, such as a type extracted from a const array or object. In TypeScript
  or TSX files. Types extracted from Effect schemas are covered by
  type-alias-before-schema.
assertion: Place the type alias directly above its same-named value, with no
  other declarations between them, and give the pair one shared TSDoc comment
  above the type alias rather than separate comments.
purpose: Keep a value and the type derived from it readable as one declaration,
  so readers find both together and their documentation cannot drift apart.
---
```diff
-/** Services the host provides once to every extension. */
-export const HostServices = [FileSystem.FileSystem, Path.Path] as const
-
-/** Services the host provides once to every extension. */
-export type HostServices = Context.Service.Identifier<(typeof HostServices)[number]>
+/** Services the host provides once to every extension. */
+export type HostServices = Context.Service.Identifier<(typeof HostServices)[number]>
+export const HostServices = [FileSystem.FileSystem, Path.Path] as const
```
