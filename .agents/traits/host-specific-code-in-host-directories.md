---
name: host-specific-code-in-host-directories
subject: Modules that depend on one host environment (such as the local
  filesystem, Git, processes, or a CLI), and imports between a package's
  portable core, its host directories, and its front ends. In TypeScript files.
assertion: Put host-specific functionality shared by more than one front end
  in a dedicated host directory, such as local/, rather than the package's top
  level, and have front ends such as Cli/ and mcp/ import it from there;
  host-specific code used by only one front end may stay in that front end's
  directory. Portable core modules never import from host directories or front
  ends. Contracts stay in the core, and their host-specific implementations,
  including layers, go in the host directory, split as
  separate-host-specific-service-implementations describes.
purpose: Keep the core usable by other hosts, such as a hosted service, and make
  host-specific dependencies visible from file paths.
---
```diff
-// traits/Segmenter/SegmenterRegistry.ts (core)
-import * as ExtensionRegistry from "../local/ExtensionRegistry.ts"
-export class SegmenterRegistry extends Context.Service<SegmenterRegistry>()("traits/Segmenter/SegmenterRegistry", {
-  make: ExtensionRegistry.make(/* imports workspace files */)
-}) {}
+// traits/Segmenter/SegmenterRegistry.ts (core): the contract only
+export class SegmenterRegistry extends Context.Service<SegmenterRegistry, SegmentChange>()(
+  "traits/Segmenter/SegmenterRegistry"
+) {}
+
+// traits/local/LocalSegmenterRegistry.ts (host): the implementation, used as LocalSegmenterRegistry.layer
+export const layer = Layer.effect(SegmenterRegistry, ExtensionRegistry.make(/* ... */))
```

Correct: `traits/mcp/Server.ts` and `traits/Cli/Cli.ts` import `WorkspaceCheck` from `traits/local/`, while `traits/Check/` depends only on the registry tags.
