---
name: hand-approval-back-to-the-calling-agent
subject: Agent tool workflows proposing changes that require user approval when
  MCP elicitation is unavailable or unreliable.
assertion: Return the complete proposal and clear instructions for the calling
  agent to ask the user through its native prompting mechanism or conversation.
  Prefer returning the reviewed proposal with the user's explicit decision over
  introducing a separate approval CLI, sidecar, or server-side pending-proposal
  tracking. Bind saving to the reviewed content and request fresh review if it
  changes.
purpose: Keep approval in the user's existing conversation without unnecessary
  coordination machinery or lost review context.
---
