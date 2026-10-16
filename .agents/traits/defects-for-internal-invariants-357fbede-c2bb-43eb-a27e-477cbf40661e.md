---
id: 357fbede-c2bb-43eb-a27e-477cbf40661e
name: defects-for-internal-invariants
when: designing library error channels for validation or encoding of internally constructed data.
mime: [text/typescript, text/tsx]
---
In library code, distinguish internal invariant violations from expected operational failures. Treat validation or encoding failures of internally constructed, already-typed data as defects when consumers cannot meaningfully recover: pipe(value, S.encodeEffect(schema), Effect.orDie), rather than exposing SchemaError in the public error channel. Preserve typed errors for invalid consumer input, configuration, network, storage, and other actionable operational failures; a handler not catching an error does not make it a defect.
