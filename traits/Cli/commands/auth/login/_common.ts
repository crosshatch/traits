import { Config, Console, Effect, flow, Option, Redacted, String } from "effect"
import { CliError, Flag, Prompt, TerminalCapabilities } from "effect/cli"

import * as Accounts from "../../../../local/user/Accounts.ts"
import { AccountName } from "../../../../local/user/Provider/AccountName.ts"
import { Credential } from "../../../../local/user/Provider/Credential.ts"
import { ProviderAccount } from "../../../../local/user/Provider/ProviderAccount.ts"
import type { ProviderId } from "../../../../local/user/Provider/ProviderId.ts"

export const commonFlags = {
  account: Flag.String("account").pipe(Flag.withSchema(AccountName), Flag.optional),
  keyEnv: Flag.String("key-env").pipe(
    Flag.withDescription("Read the API key from this environment variable, never from argv"),
    Flag.optional
  )
}

/** Reads a nonblank API key from the named environment variable, or else from a terminal prompt showing the message. */
const readApiKey = Effect.fn("auth.login.readApiKey")(
  function* (keyEnv: Option.Option<string>, message: string) {
    const variable = Option.getOrUndefined(keyEnv)
    if (variable !== undefined) {
      return yield* Config.Redacted(variable).pipe(
        Effect.catchTags({
          ConfigError: () =>
            CliError.UserError.make({
              cause: `Could not read an API key from environment variable ${variable}. Set it to a nonblank API key and retry.`
            })
        })
      )
    }
    const { canPrompt } = yield* TerminalCapabilities.TerminalCapabilities
    if (!canPrompt) {
      return yield* CliError.UserError.make({
        cause: "Interactive API-key entry requires a terminal. Use --key-env <variable> in headless mode."
      })
    }
    return yield* Prompt.run(Prompt.Password({ message }))
  },
  Effect.filterOrFail(flow(Redacted.value, String.trim, String.isNonEmpty), () =>
    CliError.UserError.make({ cause: "An API key is required." })
  )
)

/** Reads an API key from --key-env or a prompt and saves it as the provider's account, named for the provider unless --account is given; the key is not verified remotely. */
export const saveApiKey = Effect.fn("auth.login.saveApiKey")(function* (options: {
  readonly provider: ProviderId
  /** What the prompt asks for, such as "OpenAI API key". */
  readonly prompt: string
  readonly account: Option.Option<AccountName>
  readonly keyEnv: Option.Option<string>
  /** Provider connection settings saved with the account, such as a Cloudflare account ID. */
  readonly settings?: Readonly<Record<string, string>> | undefined
}) {
  const apiKey = yield* readApiKey(options.keyEnv, options.prompt)
  const account = ProviderAccount.make({
    id: Option.getOrElse(options.account, () => AccountName.make(options.provider)),
    provider: options.provider,
    method: "api-key",
    credential: Credential.cases.ApiKey.make({ apiKey }),
    ...(options.settings === undefined ? {} : { settings: options.settings })
  })
  yield* Accounts.save(account)
  yield* Console.log(`Saved ${account.id} (${account.provider}). The API key has not been verified remotely.`)
})
