---
id: 302bf945-57b4-4fb4-b0a6-e4baa29fb816
name: effect_foreach_for_collection_results
when: traversing a collection to perform Effects and collect the results.
mime: [text/typescript, text/tsx]
---
When traversing a collection to perform Effects and collect results, prefer Effect.forEach over a for loop that pushes into a mutable accumulator array. Preserve intended ordering, filtering, and concurrency semantics.
