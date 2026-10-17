---
name: jsx-same-named-prop-spreads
when: passing same-named variables as ordinary React JSX props.
mime: [text/tsx, text/jsx]
---

```diff
-<Step key={id} step={step} index={index} />
+<Step key={id} {...{ step, index }} />
```

---
In React JSX, prefer object-spread shorthand for ordinary props whose values are same-named variables: {...{ step, index }} instead of step={step} index={index}. Keep React’s special key prop explicit, and use explicit assignments for renamed or computed values.
