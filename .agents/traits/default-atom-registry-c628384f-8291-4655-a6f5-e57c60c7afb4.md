---
id: c628384f-8291-4655-a6f5-e57c60c7afb4
name: default-atom-registry
when: using Effect atom hooks, registries, or per-instance React state isolation.
mime: text/tsx
skip: When every RegistryProvider under assessment defines a genuinely required distinct boundary for subtree-wide isolation, hydration, or custom registry configuration.
---
When using Effect atom hooks in React, prefer the default registry rather than adding RegistryProvider wrappers. Isolate component-local state with per-instance atoms instead of a separate registry per component. Use RegistryProvider only when a distinct registry boundary is genuinely required, such as deliberate subtree-wide isolation, hydration, or custom registry configuration.
