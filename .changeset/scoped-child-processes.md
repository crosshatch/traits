---
"traits": patch
---

Simplify command execution using Effect's scoped process spawner. Preserve
normal child exit codes and keep the collector alive during child cleanup.
Interruption uses standard SIGTERM process-group cleanup instead of exact signal
forwarding and re-emission. Inline run implementation into its CLI command.
