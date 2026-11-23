---
name: export-service-layers-at-module-scope
subject: Namespace-oriented Effect modules that colocate a service declaration
  with its implementation layers.
match: "**/*.{ts,tsx,mts,cts}"
assertion: Expose implementation layers as module-level exported constants below
  the service declaration, rather than static members on the service class, so
  consumers use Module.layer instead of Module.Service.layer. Follow the
  existing layer-naming conventions, including qualified names where
  appropriate. This does not require moving host-specific implementations into
  core contract modules or changing explicitly class-owned APIs in other
  modules.
purpose: Keep namespace-oriented service APIs consistent and separate service
  identity from implementation wiring.
---
