import { Schema as S } from "effect"

/** Secret material for a saved provider account; encoding secrets produces plaintext, not encryption. */
export type Credential = typeof Credential.Type
export const Credential = S.TaggedUnion({
  ApiKey: {
    apiKey: S.RedactedFromValue(S.NonEmptyString)
  },
  OAuth: {
    accessToken: S.RedactedFromValue(S.NonEmptyString),
    refreshToken: S.RedactedFromValue(S.NonEmptyString).pipe(S.optionalKey),
    /** Access token expiration as Unix epoch milliseconds. */
    expiresAt: S.Natural.annotateKey({ description: "Access token expiration as Unix epoch milliseconds." }).pipe(
      S.optionalKey
    ),
    scopes: S.Array(S.NonEmptyString).check(S.isUnique()).pipe(S.optionalKey),
    metadata: S.Record(S.String, S.String).pipe(S.optionalKey)
  }
}).annotate({
  description: "Secret material for a saved provider account; encoding secrets produces plaintext, not encryption."
})
