import { Effect, Option } from "effect"
import { Command } from "effect/cli"

import * as ApiKey from "../../../_util/ApiKey.ts"
import { AccountName } from "../../../Provider/AccountName.ts"
import { Credential } from "../../../Provider/Credential.ts"
import { ProviderAccount } from "../../../Provider/ProviderAccount.ts"
import { commonFlags, saveAccount } from "./_common.ts"

export const openai = Command.make(
  "openai",
  commonFlags,
  Effect.fn("auth.login.openai")(function* (params) {
    const apiKey = yield* ApiKey.read(params.keyEnv, "OpenAI API key")
    yield* saveAccount(
      ProviderAccount.make({
        id: Option.getOrElse(params.account, () => AccountName.make("openai")),
        provider: "openai",
        method: "api-key",
        credential: Credential.cases.ApiKey.make({ apiKey })
      })
    )
  })
).pipe(Command.withDescription("Save an OpenAI API-key account"))
