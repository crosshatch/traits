---
name: effect-utilities-with-native-behavior-exceptions
subject: Collection, string, numeric, and other utility choices beyond inline comparisons and simple runtime checks.
requirement: "Except for inline comparisons and simple runtime checks, prefer
  equivalent Effect utilities over JavaScript built-in methods and functions,
  including utilities from Array, Record, BigInt, Boolean, Number, RegExp,
  String, and Struct; for example, use `Array.map(items, f)` instead of
  `items.map(f)`. Use built-ins when no suitable Effect equivalent exists or
  when required to preserve behavior. For local mutable accumulators, prefer
  built-in mutations when Effect has no equivalent mutation: use
  `items.push(value)`, not copying and reassigning with `items =
  Array.append(items, value)`."
applicability: |-
  File types or languages: text/typescript, text/tsx.
  Exception: When all native utility choices under assessment are required to preserve behavior or lack a suitable Effect equivalent, including local mutations without an Effect mutation equivalent.
---
```diff
-const names = items.map((item) => item.name)
+const names = Array.map(items, (item) => item.name)
```
