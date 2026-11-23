import { Effect, FileSystem, pipe, Schema as S } from "effect"

import { StorageError } from "../StorageError.ts"
import { writeFile } from "../util/fs/writeFile.ts"

/** Reads a JSON file of the workspace as the schema describes it. */
export const read = Effect.fnUntraced(function* <Schema extends S.Constraint>(file: string, schema: Schema) {
  const fs = yield* FileSystem.FileSystem
  const text = yield* fs.readFileString(file).pipe(
    Effect.catchReason(
      "PlatformError",
      "NotFound",
      () => StorageError.make({ location: file, reason: { _tag: "Missing" } }),
      (_, cause) => StorageError.make({ location: file, reason: { _tag: "Unreadable" }, cause })
    )
  )
  // JSON.parse's own error gives the position of a syntax error, which a schema's JSON decoding does not.
  const json = yield* Effect.try({
    try: (): unknown => JSON.parse(text),
    catch: (cause) => StorageError.make({ location: file, reason: { _tag: "Malformed" }, cause })
  })
  return yield* pipe(
    json,
    // An invalid or unknown key is rejected rather than dropped, so an outdated or mistyped file is reported rather than misread.
    S.decodeUnknownEffect(schema, { onExcessProperty: "error" }),
    Effect.mapError((cause) => StorageError.make({ location: file, reason: { _tag: "Malformed" }, cause }))
  )
})

/** Writes the value to a JSON file of the workspace, creating it or replacing its contents in one step. */
export const write = Effect.fnUntraced(function* (file: string, value: unknown) {
  yield* writeFile(file, `${JSON.stringify(value, null, 2)}\n`).pipe(
    Effect.mapError((cause) => StorageError.make({ location: file, reason: { _tag: "Unwritable" }, cause }))
  )
})
