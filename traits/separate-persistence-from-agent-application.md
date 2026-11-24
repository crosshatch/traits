---
name: separate-persistence-from-agent-application
subject: Workflows that persist imported configuration or rules and then invoke
  an agent to apply them.
assertion: Expose persistence and agent application as independently callable
  operations. Keep terminal prompting and agent execution out of the store's
  responsibilities. Convenience commands may compose the operations, but
  application must remain retryable after persistence succeeds, without
  re-importing data or maintaining a pending-work store solely to reconnect the
  stages.
purpose: Make ownership and failure recovery clear while avoiding unnecessary
  orchestration state and coupling.
---
