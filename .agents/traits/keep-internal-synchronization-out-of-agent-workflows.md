---
name: keep-internal-synchronization-out-of-agent-workflows
subject: Model-facing tools and workflows involving derived internal state.
requirement: Keep routine synchronization and invalidation of derived internal
  state automatic rather than requiring the agent to invoke maintenance tools
  between normal operations. Expose manual maintenance controls only when they
  serve a genuine user-facing task or necessary recovery action.
purpose: Reduce tool-context overhead and avoid making application correctness
  depend on the agent remembering infrastructure bookkeeping.
---
A filesystem watcher is one possible implementation, not a universal requirement. Choose synchronization mechanisms appropriate to the application and own their lifecycle in the service.