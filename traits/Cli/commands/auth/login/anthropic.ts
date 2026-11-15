import { Command } from "effect/cli"

import { withExperimentalDescription } from "../../_common.ts"
import { commonFlags, saveApiKey } from "./_common.ts"

export const anthropic = Command.make("anthropic", commonFlags, (params) =>
  saveApiKey({ ...params, provider: "anthropic", prompt: "Anthropic API key" })
).pipe(withExperimentalDescription("Save an Anthropic API-key account"))
