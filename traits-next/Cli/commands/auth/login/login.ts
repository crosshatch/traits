import { Command } from "effect/cli"

import { anthropic } from "./anthropic.ts"
import { cloudflareWorkersAi } from "./cloudflare-workers-ai.ts"
import { openai } from "./openai.ts"
import { openrouter } from "./openrouter.ts"
import { typesafeAi } from "./typesafe-ai.ts"

export const login = Command.make("login").pipe(
  Command.withDescription("Save a provider account; OAuth is not implemented yet"),
  Command.withSubcommands([anthropic, cloudflareWorkersAi, openai, openrouter, typesafeAi])
)
