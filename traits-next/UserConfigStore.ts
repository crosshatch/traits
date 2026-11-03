import { Context, Effect, Schema as S } from "effect"
import { CliError } from "effect/cli"

import { ProviderAccount } from "./Cli/Provider/ProviderAccount.ts"
import { UserConfig } from "./UserConfig.ts"

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
>()("traits-next/UserConfigStore") {}

/** A failure loading user profiles and their active selection. */
export class UserConfigReadError extends S.TaggedError<UserConfigReadError>()("UserConfigReadError", {
  path: S.String,
  cause: S.Defect()
}) {
  override get message() {
    return `Could not read profiles from ${this.path}. Check that the file is readable and contains valid profile JSON.`
  }

  override get [CliError.userMessage]() {
    return this.message
  }
}

/** A failure loading saved provider accounts. */
export class AccountsReadError extends S.TaggedError<AccountsReadError>()("AccountsReadError", {
  path: S.String,
  cause: S.Defect()
}) {
  override get message() {
    return `Could not read provider accounts from ${this.path}. Check the file format, ownership, and permissions.`
  }

  override get [CliError.userMessage]() {
    return this.message
  }
}

/** A failure persisting user profiles and their active selection. */
export class UserConfigWriteError extends S.TaggedError<UserConfigWriteError>()("UserConfigWriteError", {
  path: S.String,
  cause: S.Defect()
}) {
  override get message() {
    return `Could not save profiles to ${this.path}. Check directory ownership, permissions, and available disk space.`
  }

  override get [CliError.userMessage]() {
    return this.message
  }
}

/** A failure persisting saved provider accounts. */
export class AccountsWriteError extends S.TaggedError<AccountsWriteError>()("AccountsWriteError", {
  path: S.String,
  cause: S.Defect()
}) {
  override get message() {
    return `Could not save provider accounts to ${this.path}. Check directory ownership, permissions, and available disk space.`
  }

  override get [CliError.userMessage]() {
    return this.message
  }
}
