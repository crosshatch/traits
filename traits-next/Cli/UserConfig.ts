import { homedir } from "node:os"

import { Config, Effect, FileSystem, Option, Path, pipe, Schema as S } from "effect"

import { Profile } from "../Profile/index.ts"
import { ProviderAccount } from "../Provider/index.ts"

export const Name = S.NonEmptyString.check(S.isPattern(/^[a-z0-9][a-z0-9._-]*$/u))

/** User-level profiles and the selected profile name; contains no credentials. */
export type UserConfig = typeof UserConfig.Type
export const UserConfig = S.Struct({
  profiles: S.Array(S.Struct({ name: Name, profile: Profile })),
  activeProfile: Name.pipe(S.optionalKey)
})

export class CliError extends S.TaggedError<CliError>()("CliError", {
  message: S.String
}) {}

export class InvalidConfigError extends S.TaggedError<InvalidConfigError>()("InvalidConfigError", {
  path: S.String
}) {
  override get message() {
    return `Invalid user configuration: ${this.path}`
  }
}

const secure = Effect.fn("Cli.secure")(function* (filename: string, type: "Directory" | "File", mode: number) {
  const fs = yield* FileSystem.FileSystem
  yield* fs.lstat(filename).pipe(
    Effect.filterOrFail(
      (info) =>
        process.platform !== "win32" &&
        info.type === type &&
        (process.getuid === undefined || Option.getOrUndefined(info.uid) === process.getuid()),
      () =>
        CliError.make({
          message: `Refusing insecure credential storage at ${filename}; expected an owned, nonsymlink ${type} on a POSIX filesystem.`
        })
    )
  )
  yield* fs.chmod(filename, mode)
})

export const paths = Effect.gen(function* () {
  const path = yield* Path.Path
  const config = yield* Config.String("XDG_CONFIG_HOME").pipe(Config.withDefault(path.join(homedir(), ".config")))
  const data = yield* Config.String("XDG_DATA_HOME").pipe(Config.withDefault(path.join(homedir(), ".local", "share")))
  if (!path.isAbsolute(config) || !path.isAbsolute(data)) {
    return yield* CliError.make({ message: "XDG_CONFIG_HOME and XDG_DATA_HOME must be absolute paths." })
  }
  return {
    configDirectory: path.join(config, "traits"),
    dataDirectory: path.join(data, "traits"),
    config: path.join(config, "traits", "profiles.json"),
    accounts: path.join(data, "traits", "credentials.json"),
    lock: path.join(data, "traits", "cli.lock")
  }
})

export const readConfig = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const location = yield* paths
  if (!(yield* fs.exists(location.config))) return UserConfig.make({ profiles: [] })
  const text = yield* fs.readFileString(location.config)
  return yield* pipe(
    text,
    S.decodeEffect(S.fromJsonString(UserConfig)),
    Effect.mapError(() => InvalidConfigError.make({ path: location.config }))
  )
})

export const readAccounts = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const location = yield* paths
  if (!(yield* fs.exists(location.accounts))) return []
  yield* secure(location.dataDirectory, "Directory", 0o700)
  yield* secure(location.accounts, "File", 0o600)
  const text = yield* fs.readFileString(location.accounts)
  return yield* pipe(
    text,
    S.decodeEffect(S.fromJsonString(S.Array(ProviderAccount))),
    Effect.mapError(() => InvalidConfigError.make({ path: location.accounts }))
  )
})

const write = Effect.fn("Cli.write")(function* (filename: string, text: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const temporary = yield* fs.makeTempFileScoped({ directory: path.dirname(filename), prefix: ".traits-" })
  yield* fs.chmod(temporary, 0o600)
  yield* fs.writeFileString(temporary, text, { mode: 0o600 })
  yield* fs.rename(temporary, filename)
}, Effect.scoped)

export const writeConfig = Effect.fn("Cli.writeConfig")(function* (config: UserConfig) {
  const location = yield* paths
  const text = yield* pipe(config, S.encodeEffect(S.fromJsonString(UserConfig)), Effect.orDie)
  yield* write(location.config, text)
})

export const writeAccounts = Effect.fn("Cli.writeAccounts")(function* (accounts: ReadonlyArray<ProviderAccount>) {
  const location = yield* paths
  const text = yield* pipe(accounts, S.encodeEffect(S.fromJsonString(S.Array(ProviderAccount))), Effect.orDie)
  yield* write(location.accounts, text)
})

/** Serializes local CLI mutations; reads happen after acquiring the lock. */
export const mutate = Effect.fn("Cli.mutate")(function* <A, E, R>(operation: Effect.Effect<A, E, R>) {
  const fs = yield* FileSystem.FileSystem
  const location = yield* paths
  yield* fs.makeDirectory(location.configDirectory, { recursive: true, mode: 0o700 })
  yield* fs.makeDirectory(location.dataDirectory, { recursive: true, mode: 0o700 })
  yield* secure(location.dataDirectory, "Directory", 0o700)
  yield* Effect.acquireRelease(
    fs.writeFileString(location.lock, String(process.pid), { flag: "wx", mode: 0o600 }).pipe(
      Effect.catchIf(
        (error) => error.reason._tag === "AlreadyExists",
        () =>
          CliError.make({
            message: `Cannot acquire CLI lock at ${location.lock}. Another command may be running; if a previous command crashed, remove only this lock file after confirming it has stopped.`
          })
      )
    ),
    () => fs.remove(location.lock).pipe(Effect.orDie)
  )
  return yield* operation
}, Effect.scoped)
