---
id: 91f2990f-cdc0-4a1c-9a10-b0939e4de481
name: react-state-and-actions-as-atoms
when: defining React component state, event handlers, or asynchronous actions.
mime: text/tsx
---
In React code, use Effect reactivity atoms instead of useState and component-local state/action functions. Define state and action atoms outside component render functions, read state with useAtomValue, and obtain event handlers with useAtomSet. Implement asynchronous actions with Atom.fn and use its context to read/write related state atoms; do not manually fork Effects from component handlers. Preserve appropriate per-instance state isolation and lifecycle cleanup.
