import { Context, Effect, Schema as S } from "effect"

export class RecordNotFound extends S.TaggedError<RecordNotFound>()("RecordNotFound", { id: S.String }) {}

export class VersionConflict extends S.TaggedError<VersionConflict>()("VersionConflict", {
  id: S.String,
  expected: S.Number
}) {}

export class StorageUnavailable extends S.TaggedError<StorageUnavailable>()("StorageUnavailable", {
  cause: S.Defect()
}) {}

export type RepositoryError = RecordNotFound | VersionConflict | StorageUnavailable

export interface StoredRecord {
  readonly id: string
  readonly version: number
  readonly data: unknown
}

export class Repository extends Context.Service<
  Repository,
  {
    readonly get: (id: string) => Effect.Effect<StoredRecord, RepositoryError>
    readonly put: (record: StoredRecord) => Effect.Effect<void, RepositoryError>
    readonly remove: (id: string, version: number) => Effect.Effect<void, RepositoryError>
  }
>()("data/Repository") {}
