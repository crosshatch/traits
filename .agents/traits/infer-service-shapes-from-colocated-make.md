---
name: infer-service-shapes-from-colocated-make
subject: Effect services with a colocated construction Effect and a class-owned
  default layer.
requirement: Prefer Context.Service<Self>()(id, { make }) to infer the service
  shape from its construction Effect, and expose the class-owned default layer
  as static readonly layer = this.make.pipe(Layer.effect(this)). Avoid
  duplicating that inferred shape in an explicit contract solely for the service
  declaration. Retain an explicit contract when it must be independent of the
  implementation.
applicability: "Only when the intended API encapsulates the default layer as a
  static member of the service class. Does not require converting module-level
  layer exports: modules representing a type or using a namespace-oriented API
  may retain export const layer so consumers can use Module.layer rather than
  Module.Service.layer."
purpose: Keep class-owned service identity, construction and layer together
  without duplicated method and error-channel declarations, while preserving
  intentional module APIs.
---
