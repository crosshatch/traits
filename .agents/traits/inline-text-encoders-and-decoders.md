---
name: inline-text-encoders-and-decoders
purpose: Keep text conversion self-contained and avoid unnecessary encoder or decoder lifecycle management.
subject: TextEncoder and TextDecoder construction.
requirement: Construct TextEncoder and TextDecoder inline where they are used
  rather than assigning instances to variables, caching them, or reusing them
  across operations.
---
```diff
-const encoder = new TextEncoder()
-const bytes = encoder.encode(text)
+const bytes = new TextEncoder().encode(text)
```
