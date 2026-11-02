import { Array, Config, Console, Duration, Effect, Option, Redacted, String } from "effect"
import { CliError, Flag, Prompt, TerminalCapabilities } from "effect/cli"

import { AccountName } from "../../../../Provider/AccountName.ts"
import { ProviderAccount } from "../../../../Provider/ProviderAccount.ts"
import { UserConfigStore } from "../../../../UserConfigStore/UserConfigStore.ts"
import { UserConfigLock } from "../../../UserConfigLock.ts"

export const commonFlags = {
  account: Flag.String("account").pipe(Flag.withSchema(AccountName), Flag.optional),
  keyEnv: Flag.String("key-env").pipe(
    Flag.withDescription("Read the API key from this environment variable, never from argv"),
    Flag.optional
  )
}

export const readApiKey = Effect.fn("auth.readApiKey")(
  function* (keyEnv: Option.Option<string>, message: string) {
    const variable = Option.getOrUndefined(keyEnv)
    if (variable !== undefined) {
      return yield* Config.Redacted(variable)
    }
    const { canPrompt } = yield* TerminalCapabilities.TerminalCapabilities
    if (!canPrompt) {
      return yield* CliError.UserError.make({
        cause: "Interactive API-key entry requires a terminal. Use --key-env <variable> in headless mode."
      })
    }
    return yield* Prompt.run(Prompt.Password({ message }))
  },
  Effect.filterOrFail(
    (value) => String.trim(Redacted.value(value)).length > 0,
    () => CliError.UserError.make({ cause: "An API key is required." })
  )
)

export const saveAccount = Effect.fn("auth.saveAccount")(function* (entry: ProviderAccount) {
  const { readAccounts, writeAccounts } = yield* UserConfigStore
  const withLock = yield* UserConfigLock
  yield* Effect.gen(function* () {
    const accounts = yield* readAccounts
    yield* writeAccounts([...Array.filter(accounts, (saved) => saved.id !== entry.id), entry])
  }).pipe((operation) => withLock(operation, Duration.minutes(2)))
  yield* Console.log(`Saved ${entry.id} (${entry.provider}). The API key has not been verified remotely.`)
})
