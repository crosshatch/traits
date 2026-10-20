import { LibsqlClient } from "@effect/sql-libsql"
import { Deferred, Effect, FileSystem, Path, Schema as S } from "effect"
import type { SqlError } from "effect/sql"

import { ProjectPaths } from "../ProjectPaths.ts"

export class TraitProjectInUseError extends S.TaggedError<TraitProjectInUseError>()("TraitProjectInUseError", {
  directory: S.String
}) {
  override get message() {
    return `A Traits MCP server already owns ${this.directory}. Connect to that server, stop it, or use a separate worktree.`
  }
}

export const acquire = Effect.gen(function* () {
  const { traitsDirectory } = yield* ProjectPaths
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  yield* fs.makeDirectory(traitsDirectory, { recursive: true })
  const canonical = yield* fs.realPath(traitsDirectory)
  const lockDirectory = path.join(canonical, ".mcp-lock")
  yield* fs.makeDirectory(lockDirectory, { recursive: true })
  yield* fs.writeFileString(path.join(lockDirectory, ".gitignore"), "*\n")
  const url = yield* path.toFileUrl(path.join(lockDirectory, "owner.db"))
  const client = yield* LibsqlClient.make({ url })
  const ready = yield* Deferred.make<void, SqlError.SqlError>()
  // Never unlink this database: all contenders must lock the same file/inode.
  yield* client.withTransaction(Deferred.succeed(ready, undefined).pipe(Effect.andThen(Effect.never))).pipe(
    Effect.catchCause((cause) => Deferred.failCause(ready, cause)),
    Effect.forkScoped
  )
  yield* Deferred.await(ready).pipe(
    Effect.catchTags({
      SqlError: (error) =>
        error.reason._tag === "LockTimeoutError" ? TraitProjectInUseError.make({ directory: canonical }) : error
    })
  )
}).pipe(Effect.withSpan("TraitProjectLock.acquire"))
