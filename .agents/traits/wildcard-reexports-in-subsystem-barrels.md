---
name: wildcard-reexports-in-subsystem-barrels
subject: TypeScript subsystem barrel modules intended to expose their
  constituent modules' complete public APIs.
assertion: Use wildcard re-exports for constituent modules (export * from, or
  export * as Name from when the barrel exposes module namespaces) rather than
  enumerating individual symbols. Preserve intentionally selective exports when
  a barrel is meant to restrict its API, and resolve name collisions explicitly
  rather than introducing ambiguous wildcard exports.
purpose: Keep complete subsystem APIs discoverable without maintaining redundant
  symbol lists.
---

```ts
export * from "./TraitEnrichment.ts"
export * from "./TraitEnrichmentContext.ts"
```

Not a violation: namespace wildcards such as `export * as Server from "./Server.ts"` in mcp/index.ts. They list no symbols, and they are the explicit collision resolution when constituents share export names (Server, TraitsCheck, and TraitsDerive each export `layer`). Violation: `export { layer, toolkit } from "./TraitsCheck.ts"`.
