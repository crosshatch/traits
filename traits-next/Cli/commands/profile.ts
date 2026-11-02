import { Array, Console, Duration, Effect, Option, Schema as S } from "effect"
import { Argument, CliError, Command, Flag } from "effect/cli"

import { Profile, ProfileName } from "../../Profile/index.ts"
import { AccountName } from "../../Provider/index.ts"
import { UserConfigStore } from "../../UserConfigStore/index.ts"
import { UserConfigLock } from "../UserConfigLock.ts"

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

const create = Command.make(
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
          () =>
            CliError.UserError.make({
              cause: `Profile ${name} already exists. Use --replace to overwrite it.`
            })
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
    }).pipe((operation) => withLock(operation, Duration.minutes(2)))
    yield* Console.log(
      `Saved profile ${name}. Model availability and role capabilities are checked when models are resolved.`
    )
  })
)

const list = Command.make(
  "list",
  {},
  Effect.fn("profile.list")(function* () {
    const { readConfig } = yield* UserConfigStore
    const config = yield* readConfig
    if (config.profiles.length === 0) return yield* Console.log("No profiles configured.")
    for (const entry of config.profiles)
      yield* Console.log(`${entry.name === config.activeProfile ? "*" : " "} ${entry.name}`)
  })
)

const show = Command.make(
  "show",
  {
    name: Argument.String("name").pipe(Argument.withSchema(ProfileName), Argument.optional)
  },
  Effect.fn("profile.show")(function* (params) {
    const { readConfig } = yield* UserConfigStore
    const config = yield* readConfig
    const selected = Option.getOrElse(params.name, () => config.activeProfile)
    const entry = Option.getOrUndefined(Array.findFirst(config.profiles, (profile) => profile.name === selected))
    if (entry === undefined)
      return yield* CliError.UserError.make({
        cause:
          selected !== undefined
            ? `Unknown profile: ${selected}`
            : "No active profile. Run traits profile create first."
      })
    yield* Console.log(JSON.stringify(entry, null, 2))
  })
)

const use = Command.make(
  "use",
  {
    name: Argument.String("name").pipe(Argument.withSchema(ProfileName))
  },
  Effect.fn("profile.use")(function* (params) {
    const { readConfig, writeConfig } = yield* UserConfigStore
    const withLock = yield* UserConfigLock
    const { name } = params
    yield* Effect.gen(function* () {
      const config = yield* readConfig.pipe(
        Effect.filterOrFail(
          (config) => Array.some(config.profiles, (entry) => entry.name === name),
          () => CliError.UserError.make({ cause: `Unknown profile: ${name}` })
        )
      )
      yield* writeConfig({ ...config, activeProfile: name })
    }).pipe((operation) => withLock(operation, Duration.minutes(2)))
    yield* Console.log(`Using profile ${name}.`)
  })
)

const remove = Command.make(
  "remove",
  {
    name: Argument.String("name").pipe(Argument.withSchema(ProfileName))
  },
  Effect.fn("profile.remove")(function* (params) {
    const { readConfig, writeConfig } = yield* UserConfigStore
    const withLock = yield* UserConfigLock
    const { name } = params
    yield* Effect.gen(function* () {
      const config = yield* readConfig.pipe(
        Effect.filterOrFail(
          (config) => Array.some(config.profiles, (entry) => entry.name === name),
          () => CliError.UserError.make({ cause: `Unknown profile: ${name}` })
        )
      )
      yield* writeConfig({
        profiles: Array.filter(config.profiles, (entry) => entry.name !== name),
        ...(config.activeProfile !== undefined && config.activeProfile !== name
          ? { activeProfile: config.activeProfile }
          : {})
      })
    }).pipe((operation) => withLock(operation, Duration.minutes(2)))
    yield* Console.log(`Removed profile ${name}.`)
  })
)

export const profile = Command.make("profile").pipe(
  Command.withDescription("Manage user-level model profiles"),
  Command.withSubcommands([create, list, show, use, remove])
)
