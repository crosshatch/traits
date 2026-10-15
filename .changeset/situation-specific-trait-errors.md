---
"traits": patch
---

Replace generic trait parsing and synthetic storage failures with
situation-specific tagged errors carrying actionable file, UUID, and YAML
position context. Add contextual assessment-size and Git-listing failures,
preserve native operational and validation errors, and expose concrete failure
schemas through both MCP tools. Return declared failures as encoded MCP errors
so context is not reduced to message text, while keeping provider request
metadata private.
