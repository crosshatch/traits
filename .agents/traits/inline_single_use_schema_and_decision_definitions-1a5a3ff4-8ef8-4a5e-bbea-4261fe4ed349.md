---
id: 1a5a3ff4-8ef8-4a5e-bbea-4261fe4ed349
name: inline_single_use_schema_and_decision_definitions
activation: When defining single-use schemas, transcoders, or lightweight Decision.make values.
mime: [text/typescript, text/tsx]
skip: When extracting a schema, transcoder, or Decision.make definition is needed for readability or justified by profiled construction overhead.
---
Prefer inlining single-use schemas, schema transcoder definitions, and lightweight Decision.make definitions at their call sites instead of adding separate constants and names: DecisionModel.decide(Decision.make({ input: S.Struct({ text: S.String }), decisions: { ... } }), options). Extract definitions when reused, when needed for readability, or when profiling shows meaningful construction overhead.
