/**
 * Mutual exclusion for local CLI configuration and credential updates.
 * The timeout covers kernel lock acquisition, not semaphore queueing or operation time.
 * Not reentrant; no rollback. Nonblocking attempts keep waiting interruptible.
 * Effect FileSystem does not expose the native descriptor required by the locking API.
 * Never unlink or replace the persistent lock file; closing its handle releases the lock.
 * UserConfigLockSetupError reports service initialization failures.
 * UserConfigLockError reports lock-use failures; protected operation errors propagate unchanged.
 */
import { Context, Duration, Effect, FileSystem, Layer, Option, Schedule, Schema as S, Scope, Semaphore } from "effect"

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
    const semaphore = yield* Semaphore.make(1)
    const [{ tryLock }, { constants, open }] = yield* Effect.all(
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
    )
    return <A, E, R>(operation: Effect.Effect<A, E, R>, timeout: Duration.Duration) =>
      Effect.scopedWith((scope) =>
        Effect.gen(function* () {
          yield* fs.makeDirectory(dataDirectory, { recursive: true, mode: 0o700 })
          yield* fs.lstat(dataDirectory).pipe(
            Effect.filterOrFail(
              (info) =>
                process.platform !== "win32" &&
                info.type === "Directory" &&
                (process.getuid === undefined || Option.getOrUndefined(info.uid) === process.getuid()),
              () =>
                UserConfigLockError.make({
                  path: dataDirectory,
                  message: `Refusing insecure lock storage at ${dataDirectory}; expected an owned, nonsymlink directory on a POSIX filesystem.`
                })
            )
          )
          yield* fs.chmod(dataDirectory, 0o700)
          const file = yield* Effect.tryPromise({
            try: () => open(lock, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600),
            catch: (cause) =>
              UserConfigLockError.make({
                path: lock,
                message: "Failed to open the lock file without following symbolic links.",
                cause
              })
          }).pipe((acquire) =>
            Effect.acquireRelease(acquire, (file) => Effect.promise(() => file.close()).pipe(Effect.orDie))
          )
          yield* Effect.tryPromise({
            try: () => file.stat(),
            catch: (cause) =>
              UserConfigLockError.make({ path: lock, message: "Failed to inspect the open lock file.", cause })
          }).pipe(
            Effect.filterOrFail(
              (info) => info.isFile() && (process.getuid === undefined || info.uid === process.getuid()),
              () =>
                UserConfigLockError.make({
                  path: lock,
                  message: `Refusing insecure lock storage at ${lock}; expected an owned, nonsymlink file on a POSIX filesystem.`
                })
            ),
            Effect.filterOrFail(
              (info) => info.size === 0,
              () =>
                UserConfigLockError.make({
                  path: lock,
                  message: `The lock file at ${lock} contains a legacy lock marker. Stop all older CLI processes before removing that marker and retrying; their locks are not compatible with kernel locking.`
                })
            )
          )
          yield* Effect.tryPromise({
            try: () => file.chmod(0o600),
            catch: (cause) =>
              UserConfigLockError.make({
                path: lock,
                message: "Failed to restrict permissions on the open lock file.",
                cause
              })
          })
          yield* Effect.try({
            try: () => tryLock(file.fd),
            catch: (cause) =>
              UserConfigLockError.make({ path: lock, message: "Native lock acquisition failed.", cause })
          }).pipe(Effect.repeat({ until: (granted) => granted, schedule: Schedule.spaced("50 millis") }))
        }).pipe(
          Scope.provide(scope),
          Effect.catchTags({
            PlatformError: (cause) =>
              UserConfigLockError.make({
                path: lock,
                message: "Failed to prepare user configuration lock storage.",
                cause
              })
          }),
          Effect.timeoutOrElse({
            duration: timeout,
            orElse: () =>
              UserConfigLockError.make({
                path: lock,
                message: `Timed out after ${Duration.toMillis(timeout)}ms waiting for the user configuration lock at ${lock}. Another operation may still hold it; do not delete the lock file.`
              })
          }),
          Effect.andThen(operation)
        )
      ).pipe(semaphore.withPermit, Effect.withSpan("UserConfigLock.withLock"))
  })
}) {
  static readonly layer = this.make.pipe(Layer.effect(UserConfigLock))
}
