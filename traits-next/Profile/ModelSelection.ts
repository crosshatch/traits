import { Schema as S } from "effect"

import { AccountName } from "../Provider/AccountName.ts"

/** A saved provider model or custom Effect AI layer module; role capabilities are validated when resolved. */
export type ModelSelection = typeof ModelSelection.Type
export const ModelSelection = S.TaggedUnion({
  Provider: {
    account: AccountName,
    model: S.NonEmptyString.check(S.isTrimmed())
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
