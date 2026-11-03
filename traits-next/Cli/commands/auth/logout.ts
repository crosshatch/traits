import { Array, Console, Effect } from "effect"
import { Argument, CliError, Command } from "effect/cli"

import { UserConfigStore } from "../../../UserConfigStore.ts"
import { ModelSelection } from "../../Profile/ModelSelection.ts"
import { AccountName } from "../../Provider/AccountName.ts"
import { UserConfigLock } from "../../UserConfigLock.ts"

export const logout = Command.make(
  "logout",
  {
    account: Argument.String("account").pipe(Argument.withSchema(AccountName))
  },
  Effect.fn("auth.logout")(function* (params) {
    const { readAccounts, readConfig, writeAccounts } = yield* UserConfigStore
    const withLock = yield* UserConfigLock
    const { account } = params
    yield* Effect.gen(function* () {
      const accounts = yield* readAccounts.pipe(
        Effect.filterOrFail(
          (accounts) => Array.some(accounts, (entry) => entry.id === account),
          () => CliError.UserError.make({ cause: `Unknown account: ${account}` })
        )
      )
      const config = yield* readConfig
      const references = Array.filter(config.profiles, (entry) =>
        Array.some(
          [entry.profile.language, entry.profile.embedding, entry.profile.decision],
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
      yield* writeAccounts(Array.filter(accounts, (entry) => entry.id !== account))
    }).pipe(withLock)
    yield* Console.log(`Removed local credentials for ${account}; the provider key has not been revoked.`)
  })
)
