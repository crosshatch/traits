---
name: prune-configuration
description: Audit and simplify configuration, scripts, and supporting files by removing redundancy and unnecessary complexity.
---

# Prune Configuration

Remove unnecessary, duplicate, and dead configuration. Every setting, script,
dependency, and config file should serve a current requirement.

- Ask: **What changes if this is removed, and do we need that difference?**
- Trace consumers and inheritance; prefer verified tool defaults over repetition.
- Consolidate overlapping configuration and remove unused files and indirection.
- Update affected references and documentation.
- Preserve intended behavior and verify it with proportionate checks.
