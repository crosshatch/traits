---
name: built-in-effect-cli-user-errors
subject: Effect CLI command modules (effect/cli Command handlers) that define
  or fail with their own error class or schema whose only payload is a
  user-facing message.
assertion: Use CliError.UserError from effect/cli instead of defining a custom
  equivalent error schema for message-only user-facing failures. As an
  exception, keep a custom error when callers need its domain-specific identity
  for recovery (they match it by tag or type) or when it adds custom runtime
  behavior, such as a distinct Runtime.errorExitCode. An unexported error that
  no code matches with catchTag or catchTags has no recovery identity.
purpose: Reuse the CLI runner's established error formatting without maintaining
  redundant error schemas.
---
```diff
-import { CliError } from "../CliError.ts"
+import { CliError } from "effect/cli"

-return yield* CliError.make({ message: `Unknown account: ${account}` })
+return yield* CliError.UserError.make({ cause: `Unknown account: ${account}` })
```

`CliError.UserError` always exits with code 1. A custom error class that sets `[Runtime.errorExitCode] = 2` (e.g. to keep a documented exit-code contract where 1 means something else) is not an equivalent and is not a violation. A custom message-only error with no such behavior is.
