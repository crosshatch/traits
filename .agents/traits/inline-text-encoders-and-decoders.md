---
name: inline-text-encoders-and-decoders
---

```diff
-const encoder = new TextEncoder()
-const bytes = encoder.encode(text)
+const bytes = new TextEncoder().encode(text)
```

---
Construct TextEncoder and TextDecoder inline where they are used rather than assigning instances to variables, caching them, or reusing them across operations.
