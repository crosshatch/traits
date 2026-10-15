---
id: ae1601fd-db74-4856-8bc2-5bfcd5b311a7
name: schema_validated_configuration
activation: When loading and validating configuration with Effect Config.
mime: [text/typescript, text/tsx]
---
Validate configuration through `Config.schema` with appropriate schemas and checks: `Config.schema(S.Finite.check(S.isGreaterThan(0)), "TIMEOUT")`, not `Config.Number("TIMEOUT")` followed by manual conditions. Use `S.Finite` for finite numbers and add any required bounds.
