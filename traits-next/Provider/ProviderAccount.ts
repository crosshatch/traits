import { Schema as S } from "effect"

import { Credential } from "./Credential.ts"
import { ProviderId } from "./ProviderId.ts"

/** A saved provider connection; contains credentials and must not be stored in project configuration. */
export type ProviderAccount = typeof ProviderAccount.Type
export const ProviderAccount = S.Struct({
  id: S.NonEmptyString.check(S.isTrimmed()),
  provider: ProviderId,
  method: S.NonEmptyString.check(S.isTrimmed()),
  label: S.NonEmptyString.check(S.isTrimmed()).pipe(S.optionalKey),
  settings: S.Record(S.String, S.String).pipe(S.optionalKey),
  credential: Credential
}).annotate({
  description: "A saved provider connection; contains credentials and must not be stored in project configuration."
})
