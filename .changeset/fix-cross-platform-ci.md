---
"traits": patch
"@traits/typescript": patch
---

Canonicalize resolved extension paths before checking workspace membership,
handle Windows SystemRoot environment casing, and normalize TypeScript reference
identities across host path separators. Isolate Windows PowerShell's module path
from PowerShell 7 parents and retain ACL failure diagnostics. Correct
platform-dependent test paths and align the build compiler pin with the
installed Effect tooling.
