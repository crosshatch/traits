---
id: 2b952865-9054-4168-93a8-65ee5b7e54db
name: jsx_same_named_prop_spreads
when: passing same-named variables as ordinary React JSX props.
mime: [text/tsx, text/jsx]
---
In React JSX, prefer object-spread shorthand for ordinary props whose values are same-named variables: {...{ step, index }} instead of step={step} index={index}. Keep React’s special key prop explicit, and use explicit assignments for renamed or computed values.
