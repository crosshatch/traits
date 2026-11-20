import { Array, Effect, FileSystem, Path, pipe, Schema as S, SchemaTransformation, String } from "effect"

import { ModelId } from "../../../ModelId.ts"
import { AccountName } from "../Provider/AccountName.ts"

/** A saved provider model or custom Effect AI layer module; role capabilities are validated when resolved. */
export type ModelSelection = typeof ModelSelection.Type
export const ModelSelection = S.TaggedUnion({
  Provider: {
    account: AccountName,
    model: ModelId
  },
  Custom: {
    /** Path to a TypeScript file whose default export is an Effect AI layer; the CLI stores an absolute path. */
    path: S.NonEmptyString.check(S.isTrimmed(), S.isPattern(/\.ts$/u)).annotate({
      description:
        "Path to a TypeScript file whose default export is an Effect AI layer; the CLI stores an absolute path."
    })
  }
}).annotate({
  description: "A saved provider model or custom Effect AI layer module; role capabilities are validated when resolved."
})

/** A custom model selection does not refer to an accessible file. */
export class ModelSelectionResolutionError extends S.TaggedError<ModelSelectionResolutionError>()(
  "ModelSelectionResolutionError",
  {
    path: S.String,
    problem: S.String
  }
) {
  override get message(): string {
    return `Cannot resolve custom model layer ${this.path}: ${this.problem}`
  }
}

/** Resolves a custom layer path without importing it; provider references are unchanged. */
export const resolve = Effect.fn("ModelSelection.resolve")(function* (selection: ModelSelection) {
  if (selection._tag === "Provider") {
    return selection
  }
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const filename = path.resolve(selection.path)
  yield* fs.stat(filename).pipe(
    Effect.mapError(() =>
      ModelSelectionResolutionError.make({ path: filename, problem: "the file cannot be accessed." })
    ),
    Effect.filterOrFail(
      (info) => info.type === "File",
      () => ModelSelectionResolutionError.make({ path: filename, problem: "the path is not a file." })
    )
  )
  return ModelSelection.cases.Custom.make({ path: filename })
})

/** A model selection written as text: a path to a `.ts` layer file (absolute, `./` or `../` relative, or a bare filename) is Custom; anything else is a Provider `<account>/<model>` reference split at its first slash. */
export const ModelSelectionFromString = S.String.pipe(
  S.decodeTo(
    ModelSelection,
    SchemaTransformation.transform({
      decode: (text): typeof ModelSelection.Encoded => {
        // Directories require an explicit prefix, so `account/model.ts` remains a provider reference.
        if (/^(?:\.{1,2}[\\/]|[\\/]|[a-zA-Z]:[\\/]).*\.ts$|^[^\\/]+\.ts$/u.test(text)) {
          return { _tag: "Custom", path: text }
        }
        const [account = "", ...model] = pipe(text, String.split("/"))
        return { _tag: "Provider", account, model: pipe(model, Array.join("/")) }
      },
      encode: (selection) =>
        selection._tag === "Provider" ? `${selection.account}/${selection.model}` : selection.path
    })
  )
).annotate({
  description:
    "A model selection written as text: a path to a `.ts` layer file (absolute, `./` or `../` relative, or a bare filename) is Custom; anything else is a Provider `<account>/<model>` reference split at its first slash."
})
