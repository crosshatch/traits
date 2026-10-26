---
"traits": patch
---

Rename the identifier payload field on TraitNotFoundError and
TraitAlreadyExistsError from name to traitName, preserving Error.name for the
error type. Consumers of these error payloads should read traitName instead.
