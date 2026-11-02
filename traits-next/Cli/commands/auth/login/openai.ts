import { Effect, Option } from "effect"
import { Command } from "effect/cli"

import { AccountName } from "../../../../Provider/AccountName.ts"
import { Credential } from "../../../../Provider/Credential.ts"
import { ProviderAccount } from "../../../../Provider/ProviderAccount.ts"
import * as Shared from "./shared.ts"

export const openai = Command.make(
  "openai",
  Shared.commonFlags,
  Effect.fn("auth.login.openai")(function* (params) {
    const apiKey = yield* Shared.readApiKey(params.keyEnv, "OpenAI API key")
    yield* Shared.saveAccount(
      ProviderAccount.make({
        id: Option.getOrElse(params.account, () => AccountName.make("openai")),
        provider: "openai",
        method: "api-key",
        credential: Credential.cases.ApiKey.make({ apiKey })
      }),
      params.replace
    )
  })
).pipe(Command.withDescription("Save an OpenAI API-key account"))
