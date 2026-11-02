import { Array, Console, Effect, Schema as S } from "effect"
import { Argument, CliError, Command, Flag } from "effect/cli"

import { Profile } from "../../../Profile/Profile.ts"
import { ProfileName } from "../../../Profile/ProfileName.ts"
import { AccountName } from "../../../Provider/AccountName.ts"
import { UserConfigStore } from "../../../UserConfigStore/UserConfigStore.ts"
import { UserConfigLock } from "../../UserConfigLock.ts"

const selectionFlag = (role: string) =>
  Flag.String(role).pipe(
    Flag.withDescription("Account/model reference; model IDs may contain slashes"),
    Flag.withSchema(
      S.String.pipe(
        S.decodeTo(S.TemplateLiteralParser([AccountName, "/", S.NonEmptyString.check(S.isPattern(/^\S+$/u))]))
      )
    ),
    Flag.map((value) => ({ account: value[0], model: value[2] }))
  )

export const create = Command.make(
  "create",
  {
    name: Argument.String("name").pipe(Argument.withSchema(ProfileName)),
    language: selectionFlag("language"),
    embedding: selectionFlag("embedding"),
    decision: selectionFlag("decision"),
    replace: Flag.Boolean("replace").pipe(Flag.withDefault(false))
  },
  Effect.fn("profile.create")(function* (params) {
    const { readConfig, readAccounts, writeConfig } = yield* UserConfigStore
    const withLock = yield* UserConfigLock
    const { name, language, embedding, decision, replace } = params
    const profile = Profile.make({ language, embedding, decision })
    yield* Effect.gen(function* () {
      const config = yield* readConfig.pipe(
        Effect.filterOrFail(
          (config) => replace || !Array.some(config.profiles, (entry) => entry.name === name),
          () => CliError.UserError.make({ cause: `Profile ${name} already exists. Use --replace to overwrite it.` })
        )
      )
      const accounts = yield* readAccounts
      for (const selection of [language, embedding, decision]) {
        if (!Array.some(accounts, (account) => account.id === selection.account)) {
          return yield* CliError.UserError.make({
            cause: `Unknown account: ${selection.account}. Run traits auth login first.`
          })
        }
      }
      yield* writeConfig({
        profiles: [...Array.filter(config.profiles, (entry) => entry.name !== name), { name, profile }],
        activeProfile: config.activeProfile ?? name
      })
    }).pipe(withLock)
    yield* Console.log(
      `Saved profile ${name}. Model availability and role capabilities are checked when models are resolved.`
    )
  })
)
