---
id: 5529a182-189a-4ea1-a344-a95b69b4de25
name: infer-atom-handler-parameters
---
When passing an Effect.fn handler to Atom.fn, let the outer Atom.fn contextually infer the handler parameters rather than explicitly annotating them, especially with unknown for an unused input. Keep positional placeholders only when needed to access later parameters.