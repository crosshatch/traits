---
id: 350bedad-3ca2-473d-9f5d-c1d575471eca
name: shared_layers_at_program_boundaries
activation: When providing shared Effect service layers or choosing dependency scopes.
mime: [text/typescript, text/tsx]
skip: When every locally provided dependency under assessment has scope or configuration that genuinely belongs to that operation rather than being shared program-wide.
---
Provide shared, program-wide Effect layers at the outermost program boundary, such as the CLI entry point: use `program.pipe(Effect.provide(Database.layer))` once rather than `query.pipe(Effect.provide(Database.layer))` per call. Inner modules and handlers should declare their service dependencies and let the outer layers satisfy them, rather than constructing shared layers locally or capturing and re-providing those services per call. Keep local provisioning for dependencies whose scope or configuration genuinely belongs to that operation.
