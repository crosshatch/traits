import { Array, Console, Effect } from "effect"
import { Argument, CliError, Command } from "effect/cli"

import * as Accounts from "../../../local/Accounts.ts"
import { ModelSelection } from "../../../local/Profile/ModelSelection.ts"
import { AccountName } from "../../../local/Provider/AccountName.ts"
import * as UserConfig from "../../../local/UserConfig.ts"
import { withLock } from "../../../local/UserConfigLock.ts"
import { withExperimentalDescription } from "../_common.ts"

export const logout = Command.make(
  "logout",
  {
    account: Argument.String("account").pipe(Argument.withSchema(AccountName))
  },
  Effect.fn("auth.logout")(function* (params) {
    const { account } = params
    const accounts = yield* Accounts.read.pipe(
      Effect.filterOrFail(
        (accounts) => Array.some(accounts, (entry) => entry.id === account),
        () => CliError.UserError.make({ cause: `Unknown account: ${account}` })
      )
    )
    const { profiles } = yield* UserConfig.read
    const references = Array.filter(profiles, (entry) =>
      Array.some(
        [entry.profile.language, entry.profile.decision],
        (selection) => ModelSelection.guards.Provider(selection) && selection.account === account
      )
    )
    if (references.length > 0) {
      return yield* CliError.UserError.make({
        cause: `Account ${account} is referenced by profiles: ${Array.join(
          Array.map(references, (entry) => entry.name),
          ", "
        )}. Update or remove them first.`
      })
    }
    yield* Accounts.write(Array.filter(accounts, (entry) => entry.id !== account))
    yield* Console.log(`Removed local credentials for ${account}; the provider key has not been revoked.`)
  }, withLock)
).pipe(withExperimentalDescription("Remove an account's local credentials without revoking the provider key"))
