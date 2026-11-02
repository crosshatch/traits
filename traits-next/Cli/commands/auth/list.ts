import { Console, Effect } from "effect"
import { Command } from "effect/cli"

import { UserConfigStore } from "../../../UserConfigStore/UserConfigStore.ts"

export const list = Command.make(
  "list",
  {},
  Effect.fn("auth.list")(function* () {
    const { readAccounts } = yield* UserConfigStore
    const accounts = yield* readAccounts
    if (accounts.length === 0) {
      return yield* Console.log("No saved accounts. Run traits auth login <provider>.")
    }
    for (const account of accounts) yield* Console.log(`${account.id}\t${account.provider}\t${account.credential._tag}`)
  })
)
