import { Effect, FileSystem, Layer, Path, pipe, Schema as S } from "effect"

import { UserConfig } from "../UserConfig.ts"
import * as UserConfigStore from "../UserConfigStore.ts"
import { ProviderAccount } from "./Provider/ProviderAccount.ts"
import { UserFileSecurity } from "./UserFileSecurity.ts"
import { WorkspacePaths } from "./WorkspacePaths.ts"

class InvalidConfigError extends S.TaggedError<InvalidConfigError>()("InvalidConfigError", {
  path: S.String
}) {
  override get message() {
    return `Invalid user configuration: ${this.path}`
  }
}

/** Local storage with fresh reads, owner-only credentials, and atomic file replacement. */
export const layer = Layer.effect(
  UserConfigStore.UserConfigStore,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const { config, accounts, dataDirectory } = yield* WorkspacePaths
    const secure = yield* UserFileSecurity

    const readConfig = Effect.gen(function* () {
      if (!(yield* fs.exists(config))) {
        return UserConfig.make({ profiles: [] })
      }
      const text = yield* fs.readFileString(config)
      return yield* pipe(
        text,
        S.decodeEffect(S.fromJsonString(UserConfig)),
        Effect.mapError(() => InvalidConfigError.make({ path: config }))
      )
    }).pipe(Effect.mapError((cause) => UserConfigStore.UserConfigReadError.make({ path: config, cause })))

    const readAccounts = Effect.gen(function* () {
      if (!(yield* fs.exists(accounts))) {
        return []
      }
      yield* secure(dataDirectory, "Directory")
      yield* secure(accounts, "File")
      const text = yield* fs.readFileString(accounts)
      // Schema errors can contain input values; do not expose credential contents in diagnostics.
      return yield* pipe(
        text,
        S.decodeEffect(S.fromJsonString(S.Array(ProviderAccount))),
        Effect.mapError(() => InvalidConfigError.make({ path: accounts }))
      )
    }).pipe(Effect.mapError((cause) => UserConfigStore.AccountsReadError.make({ path: accounts, cause })))

    const write = Effect.fn("FsUserConfigStore.write")(function* (filename: string, text: string) {
      yield* fs.makeDirectory(path.dirname(filename), { recursive: true, mode: 0o700 })
      yield* secure(path.dirname(filename), "Directory")
      const temporary = yield* fs.makeTempFileScoped({ directory: path.dirname(filename), prefix: ".traits-" })
      yield* secure(temporary, "File")
      yield* fs.writeFileString(temporary, text, { mode: 0o600 })
      yield* fs.rename(temporary, filename)
    }, Effect.scoped)

    const writeConfig = Effect.fn("FsUserConfigStore.writeConfig")(
      function* (userConfig: UserConfig) {
        const text = yield* pipe(userConfig, S.encodeEffect(S.fromJsonString(UserConfig)), Effect.orDie)
        yield* write(config, text)
      },
      Effect.mapError((cause) => UserConfigStore.UserConfigWriteError.make({ path: config, cause }))
    )

    const writeAccounts = Effect.fn("FsUserConfigStore.writeAccounts")(
      function* (providerAccounts: ReadonlyArray<ProviderAccount>) {
        yield* fs.makeDirectory(dataDirectory, { recursive: true, mode: 0o700 })
        yield* secure(dataDirectory, "Directory")
        const text = yield* pipe(
          providerAccounts,
          S.encodeEffect(S.fromJsonString(S.Array(ProviderAccount))),
          Effect.orDie
        )
        yield* write(accounts, text)
      },
      Effect.mapError((cause) => UserConfigStore.AccountsWriteError.make({ path: accounts, cause }))
    )

    return UserConfigStore.UserConfigStore.of({ readConfig, readAccounts, writeConfig, writeAccounts })
  })
)
