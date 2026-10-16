---
id: f381f60d-35d6-4cea-87d6-ea1ebbd5bd28
name: flow-forwarding-pipelines
---

When a function only forwards its argument into a fixed transformation pipeline, define it with Effect’s flow rather than an arrow function wrapping pipe(value, ...). Preserve the input contract, including decodeUnknownEffect for untrusted values; keep a wrapper when additional argument-dependent logic is needed.
