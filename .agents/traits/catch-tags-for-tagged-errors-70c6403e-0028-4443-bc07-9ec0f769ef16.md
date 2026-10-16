---
id: 70c6403e-0028-4443-bc07-9ec0f769ef16
name: catch-tags-for-tagged-errors
when: recovering from tagged Effect errors.
mime: [text/typescript, text/tsx]
---
Always prefer Effect.catchTags over Effect.catchTag for tagged-error recovery, including when handling only one error tag: Effect.catchTags({ UnknownError: handler }), not Effect.catchTag("UnknownError", handler). Preserve the existing handlers and error propagation behavior.
