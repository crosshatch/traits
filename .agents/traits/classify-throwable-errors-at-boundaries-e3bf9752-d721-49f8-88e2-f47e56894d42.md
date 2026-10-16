---
id: e3bf9752-d721-49f8-88e2-f47e56894d42
name: classify-throwable-errors-at-boundaries
---

When classifying thrown failures at a boundary, prefer Effect.try({ try, catch }) to map them directly rather than creating the default UnknownError and then unwrapping its cause in catchTags. Keep recovery combinators for turning selected expected failures into successful results; the catch arm maps failures, it does not recover them.
