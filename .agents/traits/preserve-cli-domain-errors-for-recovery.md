---
name: preserve-cli-domain-errors-for-recovery
subject: User-facing domain-specific failures in Effect CLI command handlers.
requirement: Preserve the domain-specific error and expose its display text
  through CliError.userMessage rather than wrapping it solely for rendering.
applicability: Applies when the domain-specific error's identity is needed for recovery.
purpose: Preserve meaningful domain error identities while using the CLI
  runner's error formatting.
---
