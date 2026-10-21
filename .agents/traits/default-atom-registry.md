---
name: default-atom-registry
purpose: Preserve expected atom sharing and avoid accidental isolation or unnecessary registry boundaries.
subject: Registry boundaries for Effect reactivity atoms in React.
requirement: When using Effect atom hooks in React, prefer the default registry
  rather than adding RegistryProvider wrappers. Isolate component-local state
  with per-instance atoms instead of a separate registry per component. Use
  RegistryProvider only when a distinct registry boundary is genuinely required,
  such as deliberate subtree-wide isolation, hydration, or custom registry
  configuration.
applicability: |-
  File types or languages: text/tsx.
  Exception: When every RegistryProvider under assessment defines a genuinely required distinct boundary for subtree-wide isolation, hydration, or custom registry configuration.
---
```diff
-<RegistryProvider><Counter /></RegistryProvider>
+<Counter />
```
