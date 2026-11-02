import { Effect, Option } from "effect"
import { Command } from "effect/cli"

import { AccountName } from "../../../../Provider/AccountName.ts"
import { Credential } from "../../../../Provider/Credential.ts"
import { ProviderAccount } from "../../../../Provider/ProviderAccount.ts"
import * as Shared from "./shared.ts"

export const openrouter = Command.make(
  "openrouter",
  Shared.commonFlags,
  Effect.fn("auth.login.openrouter")(function* (params) {
    const apiKey = yield* Shared.readApiKey(params.keyEnv, "OpenRouter API key")
    yield* Shared.saveAccount(
      ProviderAccount.make({
        id: Option.getOrElse(params.account, () => AccountName.make("openrouter")),
        provider: "openrouter",
        method: "api-key",
        credential: Credential.cases.ApiKey.make({ apiKey })
      }),
      params.replace
    )
  })
).pipe(Command.withDescription("Save an OpenRouter API-key account"))
