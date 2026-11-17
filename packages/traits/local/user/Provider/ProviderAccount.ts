import { Schema as S } from "effect"

import { AccountName } from "./AccountName.ts"
import { Credential } from "./Credential.ts"
import { ProviderId } from "./ProviderId.ts"

/** A saved provider connection; contains credentials and must not be stored in project configuration. */
export type ProviderAccount = typeof ProviderAccount.Type
export const ProviderAccount = S.Struct({
  /** Local account name used by saved model profiles. */
  id: AccountName.annotateKey({ description: "Local account name used by saved model profiles." }),
  /** Provider identity; cannot change when updating an existing account. */
  provider: ProviderId.annotateKey({
    description: "Provider identity; cannot change when updating an existing account."
  }),
  /** Trimmed, nonempty provider authentication method identifier. */
  method: S.NonEmptyString.check(S.isTrimmed()).annotateKey({
    description: "Trimmed, nonempty provider authentication method identifier."
  }),
  /** Optional trimmed, nonempty display label for this account. */
  label: S.NonEmptyString.check(S.isTrimmed())
    .annotateKey({ description: "Optional trimmed, nonempty display label for this account." })
    .pipe(S.optionalKey),
  /** Optional provider connection settings; values are not redacted. */
  settings: S.Record(S.String, S.String)
    .annotateKey({ description: "Optional provider connection settings; values are not redacted." })
    .pipe(S.optionalKey),
  credential: Credential
}).annotate({
  description: "A saved provider connection; contains credentials and must not be stored in project configuration."
})
