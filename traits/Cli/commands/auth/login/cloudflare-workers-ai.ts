import { Schema as S } from "effect"
import { Command, Flag } from "effect/cli"

import { withExperimentalDescription } from "../../_common.ts"
import { commonFlags, saveApiKey } from "./_common.ts"

export const cloudflareWorkersAi = Command.make(
  "cloudflare-workers-ai",
  {
    ...commonFlags,
    accountId: Flag.String("account-id").pipe(
      Flag.withDescription("Cloudflare account ID (32 hexadecimal characters)"),
      Flag.withSchema(S.String.check(S.isPattern(/^[a-f0-9]{32}$/iu)))
    )
  },
  (params) =>
    saveApiKey({
      account: params.account,
      keyEnv: params.keyEnv,
      provider: "cloudflare-workers-ai",
      prompt: "Cloudflare API token",
      settings: { accountId: params.accountId }
    })
).pipe(withExperimentalDescription("Save a Cloudflare Workers AI API-token account"))
