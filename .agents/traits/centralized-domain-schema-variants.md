---
name: centralized-domain-schema-variants
---
When a domain model needs multiple related boundary shapes, declare shared fields and per-variant availability or encoding policies once with Effect VariantSchema, or Model when its standard variants fit. Expose named schemas from the domain module and reuse them instead of repeatedly spreading, picking, or omitting schema fields at call sites. Introduce variants only for genuinely different existing contracts, not speculative insert/update shapes.
