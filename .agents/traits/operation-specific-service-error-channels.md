---
name: operation-specific-service-error-channels
---
In explicit Effect service contracts, give each operation only the errors it can actually produce instead of assigning every method a shared catch-all error union. Avoid exporting an error alias used only to repeat that broad union internally. Keep native error-channel types distinct from simplified wire-response schemas.
