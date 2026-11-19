import type { AiError } from "effect/ai"

/** Whether a model provider rejected the account itself (its credentials, permissions, or quota), so no further request can succeed until the user fixes it. */
export const rejectsAccount = (error: AiError.AiError): boolean => {
  if (error.reason._tag === "AuthenticationError" || error.reason._tag === "QuotaExhaustedError") {
    return true
  }
  // Some adapters classify payment-required responses as UnknownError. Use protocol data, not provider-message matching.
  const status = "http" in error.reason ? error.reason.http?.response?.status : undefined
  return status === 401 || status === 402 || status === 403
}
