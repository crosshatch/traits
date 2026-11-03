/**
 * Mutual exclusion for local CLI configuration and credential updates.
 * The one-minute timeout covers lock setup and acquisition, not semaphore queueing or operation time.
 * Not reentrant; no rollback. Nonblocking attempts keep waiting interruptible.
 * Effect FileSystem does not expose the native descriptor required by the locking API.
 * Never unlink or replace the persistent lock file; closing its handle releases the lock.
 * Native modules are loaded on first lock use and memoized per service instance.
 * UserConfigLockSetupError reports native-module setup failures.
 * UserConfigLockError reports lock-use failures; protected operation errors propagate unchanged.
 */
import { Context, Duration, Effect, FileSystem, Layer, Option, Schedule, Schema as S, Scope, Semaphore } from "effect"

import { UserFileSecurity } from "./UserFileSecurity.ts"
import { WorkspacePaths } from "./WorkspacePaths.ts"

export class UserConfigLockSetupError extends S.TaggedError<UserConfigLockSetupError>()("UserConfigLockSetupError", {
  module: S.String,
  cause: S.Defect()
}) {
  override get message() {
    return `Failed to load ${this.module} for user configuration locking.`
  }
}

export class UserConfigLockError extends S.TaggedError<UserConfigLockError>()("UserConfigLockError", {
  path: S.String,
  message: S.String,
  cause: S.Defect().pipe(S.optional)
}) {}

export class UserConfigLock extends Context.Service<UserConfigLock>()("traits-next/Cli/UserConfigLock", {
  make: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const { dataDirectory, lock } = yield* WorkspacePaths
    const secure = yield* UserFileSecurity
    const semaphore = yield* Semaphore.make(1)
    const modules = yield* Effect.all(
      [
        Effect.tryPromise({
          try: () => import("fs-native-extensions"),
          catch: (cause) => UserConfigLockSetupError.make({ module: "fs-native-extensions", cause })
        }),
        Effect.tryPromise({
          try: () => import("node:fs/promises"),
          catch: (cause) => UserConfigLockSetupError.make({ module: "node:fs/promises", cause })
        })
      ],
      { concurrency: "unbounded" }
    ).pipe(Effect.cached)
    return <A, E, R>(operation: Effect.Effect<A, E, R>) =>
      Effect.scopedWith((scope) =>
        Effect.gen(function* () {
          const [{ tryLock }, { constants, open }] = yield* modules
          yield* fs.makeDirectory(dataDirectory, { recursive: true, mode: 0o700 })
          yield* secure(dataDirectory, "Directory")
          yield* secure(lock, "File").pipe(
            Effect.catchTags({
              PlatformError: (cause) => (cause.reason._tag === "NotFound" ? Effect.void : Effect.fail(cause))
            })
          )
          const file = yield* Effect.tryPromise({
            try: () => open(lock, constants.O_CREAT | constants.O_RDWR | (constants.O_NOFOLLOW ?? 0), 0o600),
            catch: (cause) =>
              UserConfigLockError.make({
                path: lock,
                message: "Failed to open the lock file.",
                cause
              })
          }).pipe((acquire) =>
            Effect.acquireRelease(acquire, (file) => Effect.promise(() => file.close()).pipe(Effect.orDie))
          )
          yield* secure(lock, "File")
          const info = yield* Effect.tryPromise({
            try: () => file.stat({ bigint: true }),
            catch: (cause) =>
              UserConfigLockError.make({ path: lock, message: "Failed to inspect the open lock file.", cause })
          })
          yield* fs.lstat(lock).pipe(
            Effect.filterOrFail(
              (current) => info.isFile() && current.dev === info.dev && Option.getOrUndefined(current.ino) === info.ino,
              () =>
                UserConfigLockError.make({
                  path: lock,
                  message: `The open lock file no longer matches the secured path at ${lock}.`
                })
            ),
            Effect.filterOrFail(
              () => info.size === 0n,
              () =>
                UserConfigLockError.make({
                  path: lock,
                  message: `The lock file at ${lock} contains a legacy lock marker. Stop all older CLI processes before removing that marker and retrying; their locks are not compatible with kernel locking.`
                })
            )
          )
          yield* Effect.try({
            try: () => tryLock(file.fd),
            catch: (cause) =>
              UserConfigLockError.make({ path: lock, message: "Native lock acquisition failed.", cause })
          }).pipe(Effect.repeat({ until: (granted) => granted, schedule: Schedule.spaced("50 millis") }))
        }).pipe(
          Scope.provide(scope),
          Effect.catchTags({
            UserFileSecurityError: (cause) =>
              UserConfigLockError.make({ path: cause.path, message: cause.message, cause }),
            PlatformError: (cause) =>
              UserConfigLockError.make({
                path: lock,
                message: "Failed to prepare user configuration lock storage.",
                cause
              })
          }),
          Effect.timeoutOrElse({
            duration: Duration.minutes(1),
            orElse: () =>
              UserConfigLockError.make({
                path: lock,
                message: `Timed out after one minute waiting for the user configuration lock at ${lock}. Another operation may still hold it; do not delete the lock file.`
              })
          }),
          Effect.andThen(operation)
        )
      ).pipe(semaphore.withPermit, Effect.withSpan("UserConfigLock.withLock"))
  })
}) {
  static readonly layer = this.make.pipe(Layer.effect(UserConfigLock))
}
