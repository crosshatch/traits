import type { AiError } from "effect/ai"

/** Whether a model provider rejected the account itself (its credentials, permissions, or quota), so no further request can succeed until the user fixes it. */
export const rejectsAccount = (error: AiError.AiError): boolean =>
  error.reason._tag === "AuthenticationError" || error.reason._tag === "QuotaExhaustedError"
