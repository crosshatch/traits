---
id: a72e95f6-fe9e-48d3-8d5d-66dfe2196bdc
name: curried-equality-callbacks
---

Use Equal.equals only in curried form in a pipe, flow, or callback position, preferring it over an equivalent hand-written comparison when it simplifies the expression and preserves required equality semantics (e.g., Equal.equals(0)). Keep native comparisons when these conditions are not met.
