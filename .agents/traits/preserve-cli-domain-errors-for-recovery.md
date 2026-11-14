---
name: preserve-cli-domain-errors-for-recovery
subject: User-facing domain-specific failures in Effect CLI command handlers.
  Applies only when code in the same handler, or a caller of the exported
  handler, catches the domain error by tag or type; where no code matches the
  error with catchTag or catchTags (for example an unexported error class),
  there is no recovery identity and the trait does not apply.
assertion: Preserve the domain-specific error and expose its display text
  through CliError.userMessage rather than wrapping it solely for rendering.
purpose: Preserve meaningful domain error identities while using the CLI
  runner's error formatting.
---

Not a violation: wrapping into an error that sets `Runtime.errorExitCode` or another runner-visible behavior to implement a documented exit-code contract, which `CliError.userMessage` cannot do.

Not applicable: Cli/Accounts.ts converting its failures, including the unexported InvalidAccountsError, to `CliError.UserError.make({ cause, userMessage })`. No handler or caller matches those errors by tag, so no identity is lost. Whether the conversion is justified is judged by avoid-unnecessary-operation-error-wrappers.
