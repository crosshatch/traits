---
name: shared-layers-at-program-boundaries
subject: Effect layer provisioning, including Effect.provide and Layer.provide
  calls and service classes whose layer provides other layers. In TypeScript or
  TSX files.
assertion: Provide shared, program-wide services at the outermost program
  boundary, such as the CLI entry point, once. This includes infrastructure such
  as HTTP clients, crypto, key-value storage, clocks and time zones, and platform
  services. Service layers, including a service class's static layer, and inner
  modules and handlers declare these dependencies and let the outer program
  satisfy them, rather than providing them locally, even as defaults. Keep local
  provisioning only for dependencies whose scope or configuration genuinely
  belongs to that operation, such as a layer built from that call's arguments
  or loaded configuration, an operation's own private storage, an override
  of a service for one operation (such as the real clock for a batching delay,
  or stderr logging for a stdio server), or a request resolver re-providing its
  callers' context. A comment
  describing local provision as a default or convenience does not make it an
  exception.
purpose: Make dependency ownership and sharing explicit while avoiding repeated
  construction of program-wide services.
---
```diff
-export class WorkspaceCheck extends Context.Service<WorkspaceCheck>()("WorkspaceCheck", { make }) {
-  /** The checker with default host services. */
-  static readonly layer = this.make.pipe(
-    Layer.effect(this),
-    Layer.provide([FetchHttpClient.layer, Digest.layerWebCrypto, KeyValueStore.layerMemory])
-  )
-}
+export class WorkspaceCheck extends Context.Service<WorkspaceCheck>()("WorkspaceCheck", { make }) {
+  static readonly layer = this.make.pipe(Layer.effect(this))
+}
+
+// main.ts
+Cli.pipe(Effect.provide([NodeServices.layer, FetchHttpClient.layer, Digest.layerWebCrypto, KeyValueStore.layerMemory]))
```

```diff
-const query = operation.pipe(Effect.provide(Database.layer))
-const program = query
+const query = operation
+const program = query.pipe(Effect.provide(Database.layer))
```

Not a violation: building a layer from the operation's own input, such as `Effect.provide(WorkspaceModels.layer(config))` after loading `config` in that operation, or a cache providing the file store that holds its own entries.
