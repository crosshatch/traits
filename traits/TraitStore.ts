import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core"
import { Cause, Context, Effect, PlatformError, Schema as S, String } from "effect"
import type { SqlError } from "effect/sql"

import * as Trait from "./Trait.ts"

export class TraitParseError extends S.TaggedError<TraitParseError>()("TraitParseError", {
  path: S.String,
  cause: S.Defect()
}) {
  override get message() {
    const diagnosis = S.isSchemaError(this.cause)
      ? "The document does not match the installed Trait schema. This may be a legacy format or invalid field values; inspect it before deciding migration is appropriate."
      : "The document could not be parsed. Inspect the original diagnostic for malformed YAML or missing/unterminated frontmatter; do not assume this is a schema migration."
    return String.stripMargin(`
    | Unable to parse trait ${this.path}.
    | ${Cause.pretty(Cause.fail(this.cause))}
    |
    | ${diagnosis}
    | Recovery requires developer consent. Ask the developer: "May I automatically resolve the stored-trait parse errors and retry the blocked operation?"
    | Do not change files before approval. Do not merely report the blocker and stop without offering this recovery choice. If declined, leave files unchanged and report the operation as incomplete.
    | After approval, inspect the entire affected trait store, not just the first failing file. Classify each failure and migrate repairable legacy formats to the installed Trait schema; repair malformed documents only where the intended content is clear.
    | Preserve names, authoritative requirements, applicability, exceptions, examples, and all other supporting context. If a repair is ambiguous or unsupported, ask a focused question rather than guessing, inventing intent, or dropping information. Leave already-valid traits unchanged.
    | The current format requires name, subject, requirement, and purpose in YAML frontmatter; applicability is optional text, and the Markdown body is optional context. Advisory guidance belongs in context; move legacy guidance there only after migration approval. Purpose explains intended benefit, not additional obligations. Legacy body requirements belong in requirement; when/mime/skip become applicability prose; diffs and additional information belong in context.
    | Validate all files in the affected store with the installed Trait schema and serialize format, then retry the originally blocked operation with its original arguments. Synchronization after repairs is automatic. A server restart is not necessary.
    | No automatic migration has occurred. The original operation failed; do not treat it as successful or claim a completed check until the retry succeeds.
    `)
  }
}

export class TraitNotFoundError extends S.TaggedError<TraitNotFoundError>()("TraitNotFoundError", {
  name: Trait.TraitName
}) {
  override get message() {
    return `Trait ${this.name} was not found`
  }
}

export class TraitAlreadyExistsError extends S.TaggedError<TraitAlreadyExistsError>()("TraitAlreadyExistsError", {
  name: Trait.TraitName
}) {
  override get message() {
    return `Trait ${this.name} already exists`
  }
}

export class TraitFilenameMismatchError extends S.TaggedError<TraitFilenameMismatchError>()(
  "TraitFilenameMismatchError",
  { path: S.String, expectedFilename: S.String }
) {
  override get message() {
    return `Trait filename must be ${this.expectedFilename}, received ${this.path}`
  }
}

export const TraitStoreError = S.Union([
  S.Struct({ ...TraitNotFoundError.fields, message: S.String }),
  S.Struct({ ...TraitAlreadyExistsError.fields, message: S.String }),
  S.Struct({ ...TraitFilenameMismatchError.fields, message: S.String }),
  S.Struct({ ...TraitParseError.fields, message: S.String }),
  S.TaggedStruct("PlatformError", { message: S.String }),
  S.TaggedStruct("SqlError", { message: S.String }),
  S.TaggedStruct("EffectDrizzleQueryError", { message: S.String })
])

export class TraitStore extends Context.Service<
  TraitStore,
  {
    readonly add: (
      trait: Trait.Trait
    ) => Effect.Effect<
      Trait.Trait,
      | PlatformError.PlatformError
      | TraitAlreadyExistsError
      | SqlError.SqlError
      | TraitParseError
      | TraitFilenameMismatchError
      | EffectDrizzleQueryError
    >
    readonly update: (
      trait: Trait.Trait
    ) => Effect.Effect<
      void,
      | PlatformError.PlatformError
      | TraitParseError
      | TraitNotFoundError
      | SqlError.SqlError
      | TraitFilenameMismatchError
      | EffectDrizzleQueryError
    >
    readonly get: (
      name: Trait.TraitName
    ) => Effect.Effect<
      Trait.Trait,
      | PlatformError.PlatformError
      | TraitParseError
      | TraitNotFoundError
      | SqlError.SqlError
      | TraitFilenameMismatchError
      | EffectDrizzleQueryError
    >
    readonly ls: Effect.Effect<
      ReadonlyArray<Trait.Trait>,
      | PlatformError.PlatformError
      | TraitParseError
      | TraitFilenameMismatchError
      | SqlError.SqlError
      | EffectDrizzleQueryError
    >
    readonly rm: (
      names: ReadonlyArray<Trait.TraitName>
    ) => Effect.Effect<
      void,
      | PlatformError.PlatformError
      | TraitParseError
      | TraitNotFoundError
      | SqlError.SqlError
      | TraitFilenameMismatchError
      | EffectDrizzleQueryError
    >
    readonly refresh: Effect.Effect<
      void,
      | PlatformError.PlatformError
      | TraitParseError
      | TraitFilenameMismatchError
      | SqlError.SqlError
      | EffectDrizzleQueryError
    >
  }
>()("traits/TraitStore") {}
