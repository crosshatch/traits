---
id: aba76f47-1509-485e-9446-8081cd854152
name: explicit-service-contracts
---

Define Context.Service contracts and exported plain-data models with explicit named interfaces or existing domain/library types, not Effect.Success<ReturnType<typeof factory>>. Place interfaces immediately after imports and use satisfies on constructed return objects to check the implementation against the declared contract. Keep schema-derived types for schema-owned models.
