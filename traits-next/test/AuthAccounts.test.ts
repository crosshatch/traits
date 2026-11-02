import { expect, it } from "@effect/vitest"
import { Effect, Redacted, Ref } from "effect"
import { CliError } from "effect/cli"

import { saveAccount } from "../Cli/commands/auth/login/_common.ts"
import { UserConfigLock } from "../Cli/UserConfigLock.ts"
import { AccountName } from "../Provider/AccountName.ts"
import { Credential } from "../Provider/Credential.ts"
import { ProviderAccount } from "../Provider/ProviderAccount.ts"
import { ProviderId } from "../Provider/ProviderId.ts"
import { UserConfig } from "../UserConfig.ts"
import { UserConfigStore } from "../UserConfigStore/UserConfigStore.ts"

const account = (provider: ProviderId, key: string, name = "primary") =>
  ProviderAccount.make({
    id: AccountName.make(name),
    provider,
    method: "api-key",
    credential: Credential.cases.ApiKey.make({ apiKey: Redacted.make(key) })
  })

const fixture = Effect.gen(function* () {
  const original = account("openai", "fake-original-key")
  const accounts = yield* Ref.make<ReadonlyArray<ProviderAccount>>([original])
  const store = UserConfigStore.of({
    readAccounts: Ref.get(accounts),
    writeAccounts: (entries) => Ref.set(accounts, entries),
    readConfig: Effect.succeed(UserConfig.make({ profiles: [] })),
    writeConfig: () => Effect.void
  })
  return { original, accounts, store }
})

it.effect(
  "rejects changing an account's provider without writing credentials",
  Effect.fnUntraced(function* () {
    const { original, accounts, store } = yield* fixture
    const error = yield* saveAccount(account("openrouter", "fake-new-key")).pipe(
      Effect.provideService(UserConfigStore, store),
      Effect.provideService(UserConfigLock, (operation) => operation.pipe(Effect.withSpan("test.withLock"))),
      Effect.flip
    )
    expect(error).toBeInstanceOf(CliError.UserError)
    const saved = yield* Ref.get(accounts)
    expect(saved).toEqual([original])
  })
)

it.effect(
  "updates the same provider's key and permits a different provider under a new name",
  Effect.fnUntraced(function* () {
    const { accounts, store } = yield* fixture
    const updated = account("openai", "fake-updated-key")
    const separate = account("openrouter", "fake-other-key", "router")
    yield* Effect.gen(function* () {
      yield* saveAccount(updated)
      yield* saveAccount(separate)
    }).pipe(
      Effect.provideService(UserConfigStore, store),
      Effect.provideService(UserConfigLock, (operation) => operation.pipe(Effect.withSpan("test.withLock")))
    )
    const saved = yield* Ref.get(accounts)
    expect(saved).toEqual([updated, separate])
  })
)
