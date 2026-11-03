import { Array, Effect, Schema as S } from "effect"
import { CliError } from "effect/cli"

import { UserConfigStore } from "../../UserConfigStore.ts"
import { UserConfigLock } from "../UserConfigLock.ts"
import { AccountName } from "./AccountName.ts"
import { Credential } from "./Credential.ts"
import { ProviderId } from "./ProviderId.ts"

/** A saved provider connection; contains credentials and must not be stored in project configuration. */
export type ProviderAccount = typeof ProviderAccount.Type
export const ProviderAccount = S.Struct({
  id: AccountName,
  provider: ProviderId,
  method: S.NonEmptyString.check(S.isTrimmed()),
  label: S.NonEmptyString.check(S.isTrimmed()).pipe(S.optionalKey),
  settings: S.Record(S.String, S.String).pipe(S.optionalKey),
  credential: Credential
}).annotate({
  description: "A saved provider connection; contains credentials and must not be stored in project configuration."
})

export const save = Effect.fn("ProviderAccount.save")(function* (entry: ProviderAccount) {
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
})
