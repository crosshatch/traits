import { Array, Console, Effect, FileSystem, Path, Schema as S } from "effect"
import { Argument, CliError, Command, Flag } from "effect/cli"

import { UserConfigStore } from "../../../UserConfigStore.ts"
import { ModelSelection } from "../../Profile/ModelSelection.ts"
import { Profile } from "../../Profile/Profile.ts"
import { ProfileName } from "../../Profile/ProfileName.ts"
import { AccountName } from "../../Provider/AccountName.ts"
import { UserConfigLock } from "../../UserConfigLock.ts"

const selectionFlag = (role: string) =>
  Flag.String(role).pipe(
    Flag.withDescription(
      "Account/model reference or custom .ts layer file (use ./, ../, or an absolute path for directories)"
    ),
    Flag.withSchema(
      S.Union([
        S.String.pipe(
          S.decodeTo(S.TemplateLiteralParser([AccountName, "/", S.NonEmptyString.check(S.isPattern(/^\S+$/u))]))
        ),
        S.NonEmptyString.check(
          S.isTrimmed(),
          S.isPattern(/^(?:\.{1,2}[\\/]|[\\/]|[a-zA-Z]:[\\/]).*\.ts$|^[^\\/]+\.ts$/u)
        )
      ])
    ),
    Flag.mapEffect(
      Effect.fn("profile.modelSelection")(function* (value) {
        if (typeof value === "string") {
          const path = yield* Path.Path
          const fs = yield* FileSystem.FileSystem
          const filename = path.resolve(value)
          yield* fs.stat(filename).pipe(
            Effect.catchTags({
              PlatformError: () =>
                CliError.UserError.make({ cause: `Cannot access custom model layer file: ${filename}` })
            }),
            Effect.filterOrFail(
              (info) => info.type === "File",
              () => CliError.UserError.make({ cause: `Custom model layer path is not a file: ${filename}` })
            )
          )
          return ModelSelection.cases.Custom.make({ path: filename })
        }
        return ModelSelection.cases.Provider.make({ account: value[0], model: value[2] })
      })
    )
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
    const providerSelections = Array.filter([language, embedding, decision], ModelSelection.guards.Provider)
    yield* Effect.gen(function* () {
      const config = yield* readConfig.pipe(
        Effect.filterOrFail(
          (config) => replace || !Array.some(config.profiles, (entry) => entry.name === name),
          () => CliError.UserError.make({ cause: `Profile ${name} already exists. Use --replace to overwrite it.` })
        )
      )
      if (providerSelections.length > 0) {
        const accounts = yield* readAccounts
        for (const selection of providerSelections) {
          if (!Array.some(accounts, (account) => account.id === selection.account)) {
            return yield* CliError.UserError.make({
              cause: `Unknown account: ${selection.account}. Run traits auth login first.`
            })
          }
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
