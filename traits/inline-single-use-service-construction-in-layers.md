---
name: inline-single-use-service-construction-in-layers
subject: Namespace-oriented Effect service modules whose construction Effect is
  used only by a module-level implementation layer.
match: "**/*.{ts,tsx,mts,cts}"
assertion: Place the service-construction Effect directly in the Layer.effect
  call rather than exposing it as a separate make member on the service class.
  Keep a separate constructor when it has a genuine independent use or is part
  of an explicitly class-owned API.
purpose: Keep implementation wiring in its owning layer without an unnecessary
  public construction entry point.
---
