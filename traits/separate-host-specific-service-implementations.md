---
name: separate-host-specific-service-implementations
subject: Effect modules that declare a Context.Service, and their concrete
  layers, in packages that keep host-specific code in a dedicated host directory
  the core must not import (see host-specific-code-in-host-directories), such as
  local/ or Cli/. In packages without such a directory, layers stay in their
  service module (see service-colocated-effect-layer-naming). Modules declaring
  no service or layer, such as barrels, are out of scope. Not a blanket rule to
  separate every service from its layers.
match: "**/*.{ts,tsx,mts,cts}"
assertion: Keep concrete layer implementations in separate host-owned modules,
  in the host directory, when the service-shape module must remain decoupled
  from that host. Do not import or re-export the concrete layer, or its
  implementation-only dependencies, from the service-shape module, even through
  a colocated layer definition. Keep the Context service and shared contract
  errors in the service module. Give the implementation module a descriptive
  name and export its primary layer as layer.
purpose: Prevent implementation dependencies from leaking into service contracts
  that other hosts must consume independently.
---

For example, Segmenter/SegmenterRegistry.ts defines the service and its contract, importing no host code. local/LocalSegmenterRegistry.ts exports layer and owns the workspace module loading that implementation needs; the service module must not import those implementation-only dependencies.

Not a violation: a service that belongs to a host or front end and is declared there with its layer colocated, such as local/WorkspaceRoot.ts (`static readonly layer = (directory) => ...`) or Cli/UserConfigLock.ts (`make` plus `static readonly layer`). No core module imports them, so there is no contract to decouple. The split applies only to services whose tag lives in the core, such as Segmenter/SegmenterRegistry.ts.

Out of scope: mcp/index.ts, a barrel that declares no service or layer.
