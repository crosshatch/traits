import { Console, Effect, Option } from "effect"
import { Command } from "effect/cli"

import { AccountName } from "../../../../local/Provider/AccountName.ts"
import { Credential } from "../../../../local/Provider/Credential.ts"
import { ProviderAccount, save } from "../../../../local/Provider/ProviderAccount.ts"
import * as ApiKey from "../../../ApiKey.ts"
import { withExperimentalDescription } from "../../_common.ts"
import { commonFlags } from "./_common.ts"

export const typesafeAi = Command.make(
  "typesafe-ai",
  commonFlags,
  Effect.fn("auth.login.typesafeAi")(function* (params) {
    const apiKey = yield* ApiKey.read(params.keyEnv, "Typesafe AI API key")
    const account = ProviderAccount.make({
      id: Option.getOrElse(params.account, () => AccountName.make("typesafe-ai")),
      provider: "typesafe-ai",
      method: "api-key",
      credential: Credential.cases.ApiKey.make({ apiKey })
    })
    yield* save(account)
    yield* Console.log(`Saved ${account.id} (${account.provider}). The API key has not been verified remotely.`)
  })
).pipe(withExperimentalDescription("Save a Typesafe AI API-key account"))
