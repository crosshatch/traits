import { Schema as S } from "effect"

import { AccountName } from "./AccountName.ts"
import { ProviderId } from "./ProviderId.ts"

/** Public authorization attempt details; never contains access or refresh tokens. */
export type OAuthAttempt = typeof OAuthAttempt.Type
export const OAuthAttempt = S.Struct({
  id: S.NonEmptyString,
  provider: ProviderId,
  method: S.NonEmptyString,
  url: S.URLFromString,
  instructions: S.String,
  mode: S.Literals(["auto", "code"]),
  /** Attempt expiration as Unix epoch milliseconds. */
  expiresAt: S.Natural.annotateKey({ description: "Attempt expiration as Unix epoch milliseconds." })
}).annotate({
  description: "Public authorization attempt details; never contains access or refresh tokens."
})

/** Public lifecycle state of an authorization attempt. */
export type OAuthAttemptStatus = typeof OAuthAttemptStatus.Type
export const OAuthAttemptStatus = S.TaggedUnion({
  Pending: {},
  Complete: { account: AccountName },
  Failed: { message: S.String },
  Expired: {},
  Cancelled: {}
}).annotate({ description: "Public lifecycle state of an authorization attempt." })
