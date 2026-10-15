---
id: 3d43cf7c-d5f9-47b1-8e7e-ba965f6c2046
name: effect_utilities_with_native_behavior_exceptions
activation: When choosing collection, string, numeric, or other utilities beyond inline comparisons and simple runtime checks.
mime: [text/typescript, text/tsx]
skip: When all native utility choices under assessment are required to preserve behavior or lack a suitable Effect equivalent, including local mutations without an Effect mutation equivalent.
---
Except for inline comparisons and simple runtime checks, prefer equivalent Effect utilities over JavaScript built-in methods and functions, including utilities from Array, Record, BigInt, Boolean, Number, RegExp, String, and Struct; for example, use `Array.map(items, f)` instead of `items.map(f)`. Use built-ins when no suitable Effect equivalent exists or when required to preserve behavior. For local mutable accumulators, prefer built-in mutations when Effect has no equivalent mutation: use `items.push(value)`, not copying and reassigning with `items = Array.append(items, value)`.
