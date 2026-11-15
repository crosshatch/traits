import { Command } from "effect/cli"

import { withExperimentalDescription } from "../../_common.ts"
import { commonFlags, saveApiKey } from "./_common.ts"

export const typesafeAi = Command.make("typesafe-ai", commonFlags, (params) =>
  saveApiKey({ ...params, provider: "typesafe-ai", prompt: "Typesafe AI API key" })
).pipe(withExperimentalDescription("Save a Typesafe AI API-key account"))
