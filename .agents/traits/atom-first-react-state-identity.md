---
name: atom-first-react-state-identity
when: defining Effect reactivity atom ownership, identity, or Atom.family factories in React.
mime: text/tsx
---

```diff
-import { useMemo } from "react"
 import { useAtomValue } from "@effect/atom-react"
 import { Atom } from "effect/reactivity"

+const countAtom = Atom.family((_counterId: string) => Atom.make(0))
+
 const useCounterValue = (counterId: string) => {
-  const count = useMemo(() => Atom.make(0), [counterId])
-  return useAtomValue(count)
+  return useAtomValue(countAtom(counterId))
 }
```

---
In React code using Effect reactivity atoms, prefer atom-first ownership and identity rather than React useMemo to keep atom state stable. Have Atom.family factories return atoms directly instead of ephemeral wrapper objects containing atoms, so atom hooks retain the cached values without React memoization.
