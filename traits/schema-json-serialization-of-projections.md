---
name: schema-json-serialization-of-projections
subject: Serializing a selected subset of an existing object to JSON in Effect
  code, where the subset is picked or rebuilt field by field before
  serialization. Serializing an existing value or field as a whole, such as
  JSON.stringify(config.models.decision) for a cache key, is out of scope.
assertion: Select unchanged fields with Struct.pick and serialize the result
  with an Effect Schema JSON encoder rather than manually rebuilding the subset
  and calling JSON.stringify. Reuse an existing suitable schema, including
  Schema.JsonObject for arbitrary JSON objects.
purpose: Keep field selection explicit and JSON serialization within a typed
  Effect pipeline.
---
