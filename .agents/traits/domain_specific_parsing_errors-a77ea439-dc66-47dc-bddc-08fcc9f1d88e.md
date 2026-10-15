---
id: a77ea439-dc66-47dc-bddc-08fcc9f1d88e
name: domain_specific_parsing_errors
activation: When modeling recoverable domain-specific failures at parsing boundaries.
mime: [text/typescript, text/tsx]
skip: When the parsing failure is already represented by SchemaError from input-schema validation.
---
At parsing boundaries with recoverable domain-specific failure modes, use a schema-backed tagged error rather than leaving those failures as Effect.try's generic UnknownError. Preserve the original cause where available and retain SchemaError for input-schema validation failures. Do not wrap unrelated built-in operational errors merely for consistency.
