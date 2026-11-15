import { Array, Effect, FileSystem, pipe, Schema as S } from "effect"

import { writeAtomic } from "./_common.ts"
import { AccountName } from "./Provider/AccountName.ts"
import { ProviderAccount } from "./Provider/ProviderAccount.ts"
import { withLock } from "./UserConfigLock.ts"
import { UserFileSecurity } from "./UserFileSecurity.ts"
import { UserPaths } from "./UserPaths.ts"

/** The provider accounts file could not be decoded or encoded; the schema cause is dropped so credential values are not retained. */
class InvalidAccountsError extends S.TaggedError<InvalidAccountsError>()("InvalidAccountsError", {
  /** Path of the owner-only provider accounts file. */
  path: S.String.annotateKey({ description: "Path of the owner-only provider accounts file." })
}) {
  override get message() {
    return `Invalid provider accounts: ${this.path}`
  }
}

/** The provider accounts file could not be read, secured, or decoded. */
export class AccountsReadError extends S.TaggedError<AccountsReadError>()("AccountsReadError", {
  /** The provider accounts file path. */
  path: S.String.annotateKey({ description: "The provider accounts file path." }),
  /** The underlying failure; decoding failures carry no credential values. */
  cause: S.Defect().annotateKey({
    description: "The underlying failure; decoding failures carry no credential values."
  })
}) {
  override get message(): string {
    return `Could not read provider accounts from ${this.path}. Check the file format, ownership, and permissions.`
  }
}

/** The provider accounts file could not be saved. */
export class AccountsWriteError extends S.TaggedError<AccountsWriteError>()("AccountsWriteError", {
  /** The provider accounts file path. */
  path: S.String.annotateKey({ description: "The provider accounts file path." }),
  /** The underlying failure; encoding failures carry no credential values. */
  cause: S.Defect().annotateKey({
    description: "The underlying failure; encoding failures carry no credential values."
  })
}) {
  override get message(): string {
    return `Could not save provider accounts to ${this.path}. Check directory ownership, permissions, and available disk space.`
  }
}

/** Reads fresh accounts from owner-only storage without exposing credential parsing inputs. */
export const read = Effect.gen(function* () {
  const { accounts, dataDirectory } = yield* UserPaths
  const fs = yield* FileSystem.FileSystem
  if (!(yield* fs.exists(accounts))) {
    return []
  }
  const secure = yield* UserFileSecurity
  yield* secure(dataDirectory, "Directory")
  yield* secure(accounts, "File")
  const text = yield* fs.readFileString(accounts)
  return yield* pipe(
    text,
    S.decodeEffect(S.fromJsonString(S.Array(ProviderAccount))),
    Effect.mapError(() => InvalidAccountsError.make({ path: accounts }))
  )
}).pipe(
  Effect.catch((cause) => UserPaths.use((paths) => AccountsReadError.make({ path: paths.accounts, cause }))),
  Effect.withSpan("Accounts.read")
)

/** Replaces all saved accounts; coordinate read-modify-write operations with UserConfigLock. */
export const write = Effect.fn("Accounts.write")(
  function* (saved: ReadonlyArray<ProviderAccount>) {
    const { accounts } = yield* UserPaths
    // writeAtomic creates and secures the data directory.
    const text = yield* pipe(
      saved,
      S.encodeEffect(S.fromJsonString(S.Array(ProviderAccount))),
      Effect.mapError(() => InvalidAccountsError.make({ path: accounts }))
    )
    yield* writeAtomic(accounts, text)
  },
  Effect.catch((cause) => UserPaths.use((paths) => AccountsWriteError.make({ path: paths.accounts, cause })))
)

/** An account with this name already belongs to a different provider. */
export class AccountProviderConflictError extends S.TaggedError<AccountProviderConflictError>()(
  "AccountProviderConflictError",
  {
    /** The account name already in use. */
    account: AccountName.annotateKey({ description: "The account name already in use." })
  }
) {
  override get message(): string {
    return `Account ${this.account} belongs to a different provider. Choose a different --account name, or use auth logout first; accounts referenced by profiles cannot be removed.`
  }
}

/** Saves an account, replacing a saved account with the same name and provider. */
export const save = Effect.fn("Accounts.save")(function* (entry: ProviderAccount) {
  const accounts = yield* read.pipe(
    Effect.filterOrFail(
      (accounts) => !Array.some(accounts, (saved) => saved.id === entry.id && saved.provider !== entry.provider),
      () => AccountProviderConflictError.make({ account: entry.id })
    )
  )
  yield* write([...Array.filter(accounts, (saved) => saved.id !== entry.id), entry])
}, withLock)
