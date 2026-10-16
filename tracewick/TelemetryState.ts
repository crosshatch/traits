import { Boolean, Effect, FileSystem, pipe, Schema as S, String } from "effect"

import PackageJson from "./package.json" with { type: "json" }
import type { CaptureGroup } from "./project.ts"

const Metadata = S.Struct({ format: S.Literal(1), version: S.String })

export class TelemetryResetRequired extends S.TaggedError<TelemetryResetRequired>()("TelemetryResetRequired", {
  directory: S.String,
  previousVersion: S.String,
  version: S.String,
  cause: S.Unknown.pipe(S.optionalKey)
}) {
  override get message() {
    return String.stripMargin(`
    | tracewick ${this.version} found a telemetry store from ${this.previousVersion} in ${this.directory}.
    | Continuing will delete the old local telemetry database, including all captured runs, logs and traces.
    | The database has NOT been changed. Stop old collectors, then run:
    | tracewick reset --project ${JSON.stringify(this.directory)}
    | For non-interactive use, add --yes only after approving this deletion.
    `)
  }
}

/** Check before opening SQLite or reusing an already running collector. */
export const inspect = Effect.fn("TelemetryState.inspect")(function* (group: CaptureGroup) {
  const fs = yield* FileSystem.FileSystem
  const stateExists = yield* Effect.all(
    [
      fs.exists(`${group.state}/telemetry.sqlite`),
      fs.exists(`${group.state}/telemetry.sqlite-wal`),
      fs.exists(`${group.state}/telemetry.sqlite-shm`)
    ],
    { concurrency: "unbounded" }
  ).pipe(Effect.map(Boolean.some))
  if (!stateExists) return { fresh: true }
  const databaseExists = yield* fs.exists(`${group.state}/telemetry.sqlite`)
  yield* fs.readFileString(`${group.state}/metadata.json`).pipe(
    Effect.catchReasons("PlatformError", {
      NotFound: () => fs.readFileString(`${group.state}/cache.json`)
    }),
    Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(Metadata))),
    Effect.catchReasons("PlatformError", {
      NotFound: (cause) =>
        TelemetryResetRequired.make({
          directory: group.worktree,
          previousVersion: "an unversioned/invalid telemetry store",
          version: PackageJson.version,
          cause
        })
    }),
    Effect.catchTags({
      SchemaError: (cause) =>
        TelemetryResetRequired.make({
          directory: group.worktree,
          previousVersion: "an unversioned/invalid telemetry store",
          version: PackageJson.version,
          cause
        })
    }),
    Effect.filterOrFail(
      (metadata) => databaseExists && metadata.version === PackageJson.version,
      (metadata) =>
        TelemetryResetRequired.make({
          directory: group.worktree,
          previousVersion: metadata.version,
          version: PackageJson.version
        })
    )
  )
  return { fresh: false }
})

export const recordVersion = Effect.fn("TelemetryState.recordVersion")(function* (group: CaptureGroup) {
  const fs = yield* FileSystem.FileSystem
  const serialized = yield* pipe(
    Metadata.make({ format: 1, version: PackageJson.version }),
    S.encodeEffect(S.fromJsonString(Metadata)),
    Effect.orDie
  )
  const temporary = `${group.state}/metadata.json.tmp`
  yield* fs.writeFileString(temporary, serialized)
  yield* fs.rename(temporary, `${group.state}/metadata.json`)
})

/** Caller must hold the collector startup lock and stop the existing collector first. */
export const reset = Effect.fnUntraced(function* (group: CaptureGroup) {
  const fs = yield* FileSystem.FileSystem
  yield* Effect.forEach(
    ["telemetry.sqlite-wal", "telemetry.sqlite-shm", "telemetry.sqlite", "metadata.json", "cache.json"],
    (filename) => fs.remove(`${group.state}/${filename}`, { force: true }),
    { concurrency: "unbounded", discard: true }
  )
})
