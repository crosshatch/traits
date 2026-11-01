import { Schema as S } from "effect"

/** A lowercase SHA-256 digest of versioned, canonical evaluation inputs; not a report-local identifier. */
export type Fingerprint = typeof Fingerprint.Type
export const Fingerprint = S.String.check(S.isPattern(/^[a-f0-9]{64}$/u))
  .pipe(S.brand("traits/TraitsLock/Fingerprint"))
  .annotate({
    description: "A lowercase SHA-256 digest of versioned, canonical evaluation inputs; not a report-local identifier."
  })
