import { Console, Effect } from "effect"
import { Argument, Command } from "effect/cli"

import * as Accounts from "../../../local/user/Accounts.ts"
import { AccountName } from "../../../local/user/Provider/AccountName.ts"
import { withExperimentalDescription } from "../_common.ts"

export const logout = Command.make(
  "logout",
  {
    account: Argument.String("account").pipe(Argument.withSchema(AccountName))
  },
  Effect.fn("auth.logout")(function* (params) {
    const { account } = params
    yield* Accounts.remove(account)
    yield* Console.log(`Removed local credentials for ${account}; the provider key has not been revoked.`)
  })
).pipe(withExperimentalDescription("Remove an account's local credentials without revoking the provider key"))
