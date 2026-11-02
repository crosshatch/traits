import { Effect, Option } from "effect"
import { Command } from "effect/cli"

import { AccountName } from "../../../../Provider/AccountName.ts"
import { Credential } from "../../../../Provider/Credential.ts"
import { ProviderAccount } from "../../../../Provider/ProviderAccount.ts"
import { commonFlags, readApiKey, saveAccount } from "./_common.ts"

export const typesafeAi = Command.make(
  "typesafe-ai",
  commonFlags,
  Effect.fn("auth.login.typesafeAi")(function* (params) {
    const apiKey = yield* readApiKey(params.keyEnv, "Typesafe AI API key")
    yield* saveAccount(
      ProviderAccount.make({
        id: Option.getOrElse(params.account, () => AccountName.make("typesafe-ai")),
        provider: "typesafe-ai",
        method: "api-key",
        credential: Credential.cases.ApiKey.make({ apiKey })
      })
    )
  })
).pipe(Command.withDescription("Save a Typesafe AI API-key account"))
