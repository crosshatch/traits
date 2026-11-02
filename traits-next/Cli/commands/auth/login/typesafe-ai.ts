import { Effect, Option } from "effect"
import { Command } from "effect/cli"

import { AccountName } from "../../../../Provider/AccountName.ts"
import { Credential } from "../../../../Provider/Credential.ts"
import { ProviderAccount } from "../../../../Provider/ProviderAccount.ts"
import * as Shared from "./shared.ts"

export const typesafeAi = Command.make(
  "typesafe-ai",
  Shared.commonFlags,
  Effect.fn("auth.login.typesafeAi")(function* (params) {
    const apiKey = yield* Shared.readApiKey(params.keyEnv, "Typesafe AI API key")
    yield* Shared.saveAccount(
      ProviderAccount.make({
        id: Option.getOrElse(params.account, () => AccountName.make("typesafe-ai")),
        provider: "typesafe-ai",
        method: "api-key",
        credential: Credential.cases.ApiKey.make({ apiKey })
      }),
      params.replace
    )
  })
).pipe(Command.withDescription("Save a Typesafe AI API-key account"))
