import { expect, it } from "@effect/vitest"
import { Effect, pipe, Redacted, Result, Schema as S } from "effect"

import { Profile } from "../Profile/index.ts"
import * as Provider from "../Provider/index.ts"

const decodeCredential = S.decodeUnknownEffect(Provider.Credential)
const decodeAccount = S.decodeUnknownEffect(Provider.ProviderAccount)
const decodeProfile = S.decodeUnknownEffect(Profile)
const decodeAttempt = S.decodeUnknownEffect(Provider.OAuthAttempt)
const decodeStatus = S.decodeUnknownEffect(Provider.OAuthAttemptStatus)
const decodeMethod = S.decodeUnknownEffect(Provider.ProviderAuthMethod)

it.effect(
  "redacts secrets and encodes them for persistence",
  Effect.fnUntraced(function* () {
    const input = { _tag: "ApiKey", apiKey: "test-secret" }
    const credential = yield* decodeCredential(input)
    expect(Provider.Credential.guards.ApiKey(credential)).toBe(true)
    if (!Provider.Credential.guards.ApiKey(credential)) return
    expect(Redacted.value(credential.apiKey)).toBe("test-secret")
    expect(JSON.stringify(credential.apiKey)).not.toContain("test-secret")
    const encoded = yield* pipe(credential, S.encodeEffect(Provider.Credential))
    expect(encoded).toEqual(input)
    const emptyKey = yield* Effect.result(decodeCredential({ ...input, apiKey: "" }))
    expect(Result.isFailure(emptyKey)).toBe(true)
  })
)

it.effect(
  "accepts OAuth and external credentials without optional fields",
  Effect.fnUntraced(function* () {
    yield* decodeCredential({ _tag: "OAuth", accessToken: "test-token" })
    const external = yield* decodeCredential({ _tag: "External" })
    expect(external).toEqual({ _tag: "External" })
  })
)

it.effect(
  "validates accounts and model selections",
  Effect.fnUntraced(function* () {
    const account = {
      id: "personal",
      provider: "openai",
      method: "api-key",
      credential: { _tag: "ApiKey", apiKey: "test-secret" }
    }
    yield* decodeAccount(account)
    const unknownProvider = yield* Effect.result(decodeAccount({ ...account, provider: "unknown" }))
    expect(Result.isFailure(unknownProvider)).toBe(true)
    const selection = { account: "personal", model: "example-model" }
    const profile = { language: selection, embedding: selection, decision: selection }
    const decoded = yield* decodeProfile(profile)
    expect(decoded).toEqual(profile)
    const incomplete = yield* Effect.result(decodeProfile({ language: selection }))
    expect(Result.isFailure(incomplete)).toBe(true)
  })
)

it.effect(
  "validates authorization attempts and lifecycle states",
  Effect.fnUntraced(function* () {
    const attempt = {
      id: "attempt-1",
      provider: "openai",
      method: "chatgpt",
      url: "https://example.com/authorize",
      instructions: "Sign in",
      mode: "auto",
      expiresAt: 1000
    }
    const decoded = yield* decodeAttempt(attempt)
    expect(decoded).toEqual({ ...attempt, url: new URL(attempt.url) })
    const invalidUrl = yield* Effect.result(decodeAttempt({ ...attempt, url: "invalid" }))
    expect(Result.isFailure(invalidUrl)).toBe(true)
    const invalidExpiration = yield* Effect.result(decodeAttempt({ ...attempt, expiresAt: -1 }))
    expect(Result.isFailure(invalidExpiration)).toBe(true)
    for (const status of [
      { _tag: "Pending" },
      { _tag: "Complete", account: "personal" },
      { _tag: "Failed", message: "Denied" },
      { _tag: "Expired" },
      { _tag: "Cancelled" }
    ]) {
      const decodedStatus = yield* decodeStatus(status)
      expect(decodedStatus).toEqual(status)
    }
  })
)

it.effect(
  "requires distinct, nonempty environment variable selections",
  Effect.fnUntraced(function* () {
    const method = { _tag: "Environment", id: "env", label: "Environment", variables: ["OPENAI_API_KEY"] }
    const decoded = yield* decodeMethod(method)
    expect(decoded).toEqual(method)
    for (const variables of [[], ["OPENAI_API_KEY", "OPENAI_API_KEY"]]) {
      const invalidVariables = yield* Effect.result(decodeMethod({ ...method, variables }))
      expect(Result.isFailure(invalidVariables)).toBe(true)
    }
  })
)
