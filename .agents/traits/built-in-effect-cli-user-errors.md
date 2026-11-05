---
name: built-in-effect-cli-user-errors
subject: Message-only user-facing failures in Effect CLI command handlers.
requirement: Use CliError.UserError from effect/cli instead of defining a custom
  equivalent error schema.
applicability: Applies when a domain-specific error identity is not needed for recovery.
purpose: Reuse the CLI runner's established error formatting without maintaining
  redundant error schemas.
---
```diff
-import { CliError } from "../CliError.ts"
+import { CliError } from "effect/cli"

-return yield* CliError.make({ message: `Unknown account: ${account}` })
+return yield* CliError.UserError.make({ cause: `Unknown account: ${account}` })
```