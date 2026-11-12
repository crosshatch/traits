---
name: omit-broad-internal-error-union-exports
subject: Exported error unions or aliases in Effect service contract modules.
assertion: Do not export an error alias that only repeats a broad, service-wide
  error union and that no other module uses. An alias other modules use, such as
  to type a retry policy or a handler, is not internal and may stay exported.
  Uses in other files, when supplied as context, decide this.
purpose: Avoid exposing redundant catch-all error abstractions that obscure
  operation-specific failure contracts.
enrichments:
  - "@traits/typescript/references"
---
