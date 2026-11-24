---
name: direct-effects-for-stateless-host-local-utilities
subject: Stateless host-local Effect utilities whose underlying dependencies are
  already injectable.
match: "**/*.{ts,tsx,mts,cts}"
assertion: Prefer directly exported Effect values and Effect.fn functions over a
  Context service and Layer introduced merely to group stateless host-local
  operations. Continue obtaining platform dependencies through Effect services.
  Retain or introduce a Context service when it provides meaningful
  substitutability, shared state or resource lifecycle, or an explicit
  runtime-configuration boundary.
purpose: Avoid service and layer scaffolding that adds no meaningful abstraction
  while preserving useful dependency injection.
---

For example, CLI-local account and profile file operations can export read/write directly while depending on FileSystem, WorkspacePaths, and file-security services. A lock owning a shared semaphore has meaningful state and remains a service.

A service the repository actually replaces remains a service: UserFileSecurity is swapped with Effect.provideService in tests and resolves host configuration once in its layer, and WorkspaceCheck is swapped with Layer.succeed to test the MCP tools. Such a module can still export its stateless operation directly, as WorkspaceCheck.run is.
