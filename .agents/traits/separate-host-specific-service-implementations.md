---
name: separate-host-specific-service-implementations
subject: Effect service-shape modules and their concrete layers, in packages
  that keep host-specific code in a dedicated host directory the core must not
  import (see host-specific-code-in-host-directories), such as local/ or Cli/.
  In packages without such a directory, layers stay in their service module (see
  service-colocated-effect-layer-naming). This is not a blanket requirement to
  separate every service from its layers.
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
