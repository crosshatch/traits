import { Array, Console, Effect } from "effect"
import { CliError, Flag } from "effect/cli"

import { UserConfigStore } from "../../../../UserConfigStore.ts"
import { AccountName } from "../../../Provider/AccountName.ts"
import { ProviderAccount } from "../../../Provider/ProviderAccount.ts"
import { UserConfigLock } from "../../../UserConfigLock.ts"

export const commonFlags = {
  account: Flag.String("account").pipe(Flag.withSchema(AccountName), Flag.optional),
  keyEnv: Flag.String("key-env").pipe(
    Flag.withDescription("Read the API key from this environment variable, never from argv"),
    Flag.optional
  )
}

export const saveAccount = Effect.fn("auth.saveAccount")(function* (entry: ProviderAccount) {
  const { readAccounts, writeAccounts } = yield* UserConfigStore
  const withLock = yield* UserConfigLock
  yield* Effect.gen(function* () {
    const accounts = yield* readAccounts.pipe(
      Effect.filterOrFail(
        (accounts) => !Array.some(accounts, (saved) => saved.id === entry.id && saved.provider !== entry.provider),
        () =>
          CliError.UserError.make({
            cause: `Account ${entry.id} belongs to a different provider. Choose a different --account name, or use auth logout first; accounts referenced by profiles cannot be removed.`
          })
      )
    )
    yield* writeAccounts([...Array.filter(accounts, (saved) => saved.id !== entry.id), entry])
  }).pipe(withLock)
  yield* Console.log(`Saved ${entry.id} (${entry.provider}). The API key has not been verified remotely.`)
})
