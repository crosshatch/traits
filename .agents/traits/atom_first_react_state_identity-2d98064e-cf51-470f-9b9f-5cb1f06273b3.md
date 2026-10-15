---
id: 2d98064e-cf51-470f-9b9f-5cb1f06273b3
name: atom_first_react_state_identity
when: defining Effect reactivity atom ownership, identity, or Atom.family factories in React.
mime: text/tsx
---
In React code using Effect reactivity atoms, prefer atom-first ownership and identity rather than React useMemo to keep atom state stable. Have Atom.family factories return atoms directly instead of ephemeral wrapper objects containing atoms, so atom hooks retain the cached values without React memoization.
