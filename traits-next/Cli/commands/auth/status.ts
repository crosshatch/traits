import { Array, Console, Effect, Option } from "effect"
import { CliError, Command, Flag } from "effect/cli"

import { UserConfigStore } from "../../../UserConfigStore.ts"
import { AccountName } from "../../Provider/AccountName.ts"

export const status = Command.make(
  "status",
  {
    account: Flag.String("account").pipe(Flag.withSchema(AccountName), Flag.optional)
  },
  Effect.fn("auth.status")(function* (params) {
    const { readAccounts } = yield* UserConfigStore
    const account = Option.getOrUndefined(params.account)
    const accounts = yield* readAccounts
    const selected = account !== undefined ? Array.filter(accounts, (entry) => entry.id === account) : accounts
    if (account !== undefined && selected.length === 0) {
      return yield* CliError.UserError.make({ cause: `Unknown account: ${account}` })
    }
    if (selected.length === 0) {
      return yield* Console.log("No saved accounts.")
    }
    for (const entry of selected)
      yield* Console.log(`${entry.id}: configured (${entry.provider}); remote access not verified`)
  })
)
