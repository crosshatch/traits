import { Array, Config, Console, Duration, Effect, Option, Redacted, String } from "effect"
import { Argument, CliError, Command, Flag, Prompt } from "effect/cli"

import { AccountName, Credential, ProviderAccount, ProviderId } from "../../Provider/index.ts"
import { UserConfigStore } from "../../UserConfigStore/index.ts"
import { UserConfigLock } from "../UserConfigLock.ts"

const login = Command.make(
  "login",
  {
    provider: Argument.Literals("provider", ProviderId.literals),
    account: Flag.String("account").pipe(Flag.withSchema(AccountName), Flag.optional),
    keyEnv: Flag.String("key-env").pipe(
      Flag.withDescription("Read the API key from this environment variable, never from argv"),
      Flag.optional
    ),
    accountId: Flag.String("account-id").pipe(Flag.withDescription("Cloudflare account ID"), Flag.optional),
    replace: Flag.Boolean("replace").pipe(
      Flag.withDescription("Replace an existing account explicitly"),
      Flag.withDefault(false)
    )
  },
  Effect.fn("auth.login")(function* (params) {
    const { readAccounts, writeAccounts } = yield* UserConfigStore
    const withLock = yield* UserConfigLock
    const { provider, account, replace } = params
    const keyEnv = Option.getOrUndefined(params.keyEnv)
    const accountId = Option.getOrUndefined(params.accountId)
    const id = Option.getOrElse(account, () => AccountName.make(provider))
    if (provider === "cloudflare-workers-ai" && (accountId === undefined || !/^[a-f0-9]{32}$/iu.test(accountId))) {
      return yield* CliError.UserError.make({
        cause: "Cloudflare requires --account-id with a 32-character hexadecimal account ID."
      })
    }
    if (provider !== "cloudflare-workers-ai" && accountId !== undefined) {
      return yield* CliError.UserError.make({ cause: "--account-id is only supported for cloudflare-workers-ai." })
    }
    if (keyEnv === undefined && process.stdin.isTTY !== true) {
      return yield* CliError.UserError.make({
        cause: "Interactive API-key entry requires a terminal. Use --key-env <variable> in headless mode."
      })
    }
    const key = yield* Effect.gen(function* () {
      return keyEnv !== undefined
        ? yield* Config.Redacted(keyEnv)
        : yield* Prompt.run(Prompt.Password({ message: `API key for ${provider}` }))
    }).pipe(
      Effect.filterOrFail(
        (value) => String.trim(Redacted.value(value)).length > 0,
        () => CliError.UserError.make({ cause: "An API key is required." })
      )
    )
    const credential = Credential.cases.ApiKey.make({ apiKey: key })
    const entry = ProviderAccount.make({
      id,
      provider,
      method: "api-key",
      credential,
      ...(accountId !== undefined ? { settings: { accountId } } : {})
    })
    yield* Effect.gen(function* () {
      const accounts = yield* readAccounts.pipe(
        Effect.filterOrFail(
          (accounts) => replace || !Array.some(accounts, (saved) => saved.id === id),
          () =>
            CliError.UserError.make({
              cause: `Account ${id} already exists. Use --replace to overwrite it.`
            })
        )
      )
      yield* writeAccounts([...Array.filter(accounts, (saved) => saved.id !== id), entry])
    }).pipe((operation) => withLock(operation, Duration.minutes(2)))
    yield* Console.log(`Saved ${id} (${provider}). The API key has not been verified remotely.`)
  })
).pipe(Command.withDescription("Save an API-key account; OAuth is not implemented yet"))

const list = Command.make(
  "list",
  {},
  Effect.fn("auth.list")(function* () {
    const { readAccounts } = yield* UserConfigStore
    const accounts = yield* readAccounts
    if (accounts.length === 0) return yield* Console.log("No saved accounts. Run traits auth login <provider>.")
    for (const account of accounts) yield* Console.log(`${account.id}\t${account.provider}\t${account.credential._tag}`)
  })
)

const status = Command.make(
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
    if (selected.length === 0) return yield* Console.log("No saved accounts.")
    for (const entry of selected)
      yield* Console.log(`${entry.id}: configured (${entry.provider}); remote access not verified`)
  })
)

const logout = Command.make(
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
          (selection) => selection.account === account
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
    }).pipe((operation) => withLock(operation, Duration.minutes(2)))
    yield* Console.log(`Removed local credentials for ${account}; the provider key has not been revoked.`)
  })
)

export const auth = Command.make("auth").pipe(
  Command.withDescription("Manage saved provider accounts"),
  Command.withSubcommands([login, list, status, logout])
)
