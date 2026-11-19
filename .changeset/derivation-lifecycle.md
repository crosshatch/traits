---
"traits": patch
---

Return `ApprovalRequired` and prompting instructions from `traits.derive`, so
the calling client chooses how to ask the user. Accept explicit decisions in a
follow-up call bound to the exact reviewed text and existing-file snapshot.
There is no MCP elicitation, approval sidecar, or server-side pending store.

Bound comparison time, preserve generic host-controlled approval callbacks,
report in-call progress, and strengthen feedback-trigger instructions.
