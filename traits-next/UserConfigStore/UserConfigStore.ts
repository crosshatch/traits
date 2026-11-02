import { Context, Effect, FileSystem, Layer, Option, Path, pipe, Schema as S } from "effect"

import { WorkspacePaths } from "../Cli/WorkspacePaths.ts"
import { ProviderAccount } from "../Provider/index.ts"
import { UserConfig } from "../UserConfig.ts"

/** Fresh user configuration and account storage, independent of the host environment. */
export class UserConfigStore extends Context.Service<
  UserConfigStore,
  {
    readonly readConfig: Effect.Effect<UserConfig, UserConfigReadError>
    readonly readAccounts: Effect.Effect<ReadonlyArray<ProviderAccount>, AccountsReadError>
    /** Replaces the complete configuration; coordinate read-modify-write operations with UserConfigLock. */
    readonly writeConfig: (config: UserConfig) => Effect.Effect<void, UserConfigWriteError>
    /** Replaces all saved accounts; coordinate read-modify-write operations with UserConfigLock. */
    readonly writeAccounts: (accounts: ReadonlyArray<ProviderAccount>) => Effect.Effect<void, AccountsWriteError>
  }
>()("traits-next/UserConfigStore/UserConfigStore") {}

/** A failure loading user profiles and their active selection. */
export class UserConfigReadError extends S.TaggedError<UserConfigReadError>()("UserConfigReadError", {
  cause: S.Defect()
}) {}

/** A failure loading saved provider accounts. */
export class AccountsReadError extends S.TaggedError<AccountsReadError>()("AccountsReadError", {
  cause: S.Defect()
}) {}

/** A failure persisting user profiles and their active selection. */
export class UserConfigWriteError extends S.TaggedError<UserConfigWriteError>()("UserConfigWriteError", {
  cause: S.Defect()
}) {}

/** A failure persisting saved provider accounts. */
export class AccountsWriteError extends S.TaggedError<AccountsWriteError>()("AccountsWriteError", {
  cause: S.Defect()
}) {}

class FsError extends S.TaggedError<FsError>()("UserConfigFsError", {
  message: S.String
}) {}

class InvalidConfigError extends S.TaggedError<InvalidConfigError>()("InvalidConfigError", {
  path: S.String
}) {
  override get message() {
    return `Invalid user configuration: ${this.path}`
  }
}

/** Local POSIX storage with fresh reads, owner-only credentials, and atomic file replacement. */
export const layerFromFs = Layer.effect(
  UserConfigStore,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const { config, accounts, dataDirectory } = yield* WorkspacePaths

    const secure = Effect.fn("UserConfigStore.secure")(function* (
      filename: string,
      type: "Directory" | "File",
      mode: number
    ) {
      yield* fs.lstat(filename).pipe(
        Effect.filterOrFail(
          (info) =>
            process.platform !== "win32" &&
            info.type === type &&
            (process.getuid === undefined || Option.getOrUndefined(info.uid) === process.getuid()),
          () =>
            FsError.make({
              message: `Refusing insecure credential storage at ${filename}; expected an owned, nonsymlink ${type} on a POSIX filesystem.`
            })
        )
      )
      yield* fs.chmod(filename, mode)
    })

    const readConfig = Effect.gen(function* () {
      if (!(yield* fs.exists(config))) return UserConfig.make({ profiles: [] })
      const text = yield* fs.readFileString(config)
      return yield* pipe(
        text,
        S.decodeEffect(S.fromJsonString(UserConfig)),
        Effect.mapError(() => InvalidConfigError.make({ path: config }))
      )
    }).pipe(Effect.mapError((cause) => UserConfigReadError.make({ cause })))

    const readAccounts = Effect.gen(function* () {
      if (!(yield* fs.exists(accounts))) return []
      yield* secure(dataDirectory, "Directory", 0o700)
      yield* secure(accounts, "File", 0o600)
      const text = yield* fs.readFileString(accounts)
      // Schema errors can contain input values; do not expose credential contents in diagnostics.
      return yield* pipe(
        text,
        S.decodeEffect(S.fromJsonString(S.Array(ProviderAccount))),
        Effect.mapError(() => InvalidConfigError.make({ path: accounts }))
      )
    }).pipe(Effect.mapError((cause) => AccountsReadError.make({ cause })))

    const write = Effect.fn("UserConfigStore.write")(function* (filename: string, text: string) {
      yield* fs.makeDirectory(path.dirname(filename), { recursive: true, mode: 0o700 })
      const temporary = yield* fs.makeTempFileScoped({ directory: path.dirname(filename), prefix: ".traits-" })
      yield* fs.chmod(temporary, 0o600)
      yield* fs.writeFileString(temporary, text, { mode: 0o600 })
      yield* fs.rename(temporary, filename)
    }, Effect.scoped)

    const writeConfig = Effect.fn("UserConfigStore.writeConfig")(
      function* (userConfig: UserConfig) {
        const text = yield* pipe(userConfig, S.encodeEffect(S.fromJsonString(UserConfig)), Effect.orDie)
        yield* write(config, text)
      },
      Effect.mapError((cause) => UserConfigWriteError.make({ cause }))
    )

    const writeAccounts = Effect.fn("UserConfigStore.writeAccounts")(
      function* (providerAccounts: ReadonlyArray<ProviderAccount>) {
        yield* fs.makeDirectory(dataDirectory, { recursive: true, mode: 0o700 })
        yield* secure(dataDirectory, "Directory", 0o700)
        const text = yield* pipe(
          providerAccounts,
          S.encodeEffect(S.fromJsonString(S.Array(ProviderAccount))),
          Effect.orDie
        )
        yield* write(accounts, text)
      },
      Effect.mapError((cause) => AccountsWriteError.make({ cause }))
    )

    return UserConfigStore.of({ readConfig, readAccounts, writeConfig, writeAccounts })
  })
)
