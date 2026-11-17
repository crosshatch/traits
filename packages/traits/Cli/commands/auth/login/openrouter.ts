import { Command } from "effect/cli"

import { withExperimentalDescription } from "../../_common.ts"
import { commonFlags, saveApiKey } from "./_common.ts"

export const openrouter = Command.make("openrouter", commonFlags, (params) =>
  saveApiKey({ ...params, provider: "openrouter", prompt: "OpenRouter API key" })
).pipe(withExperimentalDescription("Save an OpenRouter API-key account"))
