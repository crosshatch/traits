import { Console, Effect, Option } from "effect"
import { Command } from "effect/cli"

import { AccountName } from "../../../../local/Provider/AccountName.ts"
import { Credential } from "../../../../local/Provider/Credential.ts"
import { ProviderAccount, save } from "../../../../local/Provider/ProviderAccount.ts"
import * as ApiKey from "../../../ApiKey.ts"
import { withExperimentalDescription } from "../../_common.ts"
import { commonFlags } from "./_common.ts"

export const openrouter = Command.make(
  "openrouter",
  commonFlags,
  Effect.fn("auth.login.openrouter")(function* (params) {
    const apiKey = yield* ApiKey.read(params.keyEnv, "OpenRouter API key")
    const account = ProviderAccount.make({
      id: Option.getOrElse(params.account, () => AccountName.make("openrouter")),
      provider: "openrouter",
      method: "api-key",
      credential: Credential.cases.ApiKey.make({ apiKey })
    })
    yield* save(account)
    yield* Console.log(`Saved ${account.id} (${account.provider}). The API key has not been verified remotely.`)
  })
).pipe(withExperimentalDescription("Save an OpenRouter API-key account"))
