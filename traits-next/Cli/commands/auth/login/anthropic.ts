import { Effect, Option } from "effect"
import { Command } from "effect/cli"

import { AccountName } from "../../../../Provider/AccountName.ts"
import { Credential } from "../../../../Provider/Credential.ts"
import { ProviderAccount } from "../../../../Provider/ProviderAccount.ts"
import * as Shared from "./shared.ts"

export const anthropic = Command.make(
  "anthropic",
  Shared.commonFlags,
  Effect.fn("auth.login.anthropic")(function* (params) {
    const apiKey = yield* Shared.readApiKey(params.keyEnv, "Anthropic API key")
    yield* Shared.saveAccount(
      ProviderAccount.make({
        id: Option.getOrElse(params.account, () => AccountName.make("anthropic")),
        provider: "anthropic",
        method: "api-key",
        credential: Credential.cases.ApiKey.make({ apiKey })
      }),
      params.replace
    )
  })
).pipe(Command.withDescription("Save an Anthropic API-key account"))
