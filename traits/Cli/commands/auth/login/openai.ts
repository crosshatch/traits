import { Command } from "effect/cli"

import { withExperimentalDescription } from "../../_common.ts"
import { commonFlags, saveApiKey } from "./_common.ts"

export const openai = Command.make("openai", commonFlags, (params) =>
  saveApiKey({ ...params, provider: "openai", prompt: "OpenAI API key" })
).pipe(withExperimentalDescription("Save an OpenAI API-key account"))
