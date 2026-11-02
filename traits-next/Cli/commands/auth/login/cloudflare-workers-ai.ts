import { Effect, Option, Schema as S } from "effect"
import { Command, Flag } from "effect/cli"

import { AccountName } from "../../../../Provider/AccountName.ts"
import { Credential } from "../../../../Provider/Credential.ts"
import { ProviderAccount } from "../../../../Provider/ProviderAccount.ts"
import * as Shared from "./shared.ts"

export const cloudflareWorkersAi = Command.make(
  "cloudflare-workers-ai",
  {
    ...Shared.commonFlags,
    accountId: Flag.String("account-id").pipe(
      Flag.withDescription("Cloudflare account ID (32 hexadecimal characters)"),
      Flag.withSchema(S.String.check(S.isPattern(/^[a-f0-9]{32}$/iu)))
    )
  },
  Effect.fn("auth.login.cloudflareWorkersAi")(function* (params) {
    const apiKey = yield* Shared.readApiKey(params.keyEnv, "Cloudflare API token")
    yield* Shared.saveAccount(
      ProviderAccount.make({
        id: Option.getOrElse(params.account, () => AccountName.make("cloudflare-workers-ai")),
        provider: "cloudflare-workers-ai",
        method: "api-key",
        credential: Credential.cases.ApiKey.make({ apiKey }),
        settings: { accountId: params.accountId }
      }),
      params.replace
    )
  })
).pipe(Command.withDescription("Save a Cloudflare Workers AI API-token account"))
