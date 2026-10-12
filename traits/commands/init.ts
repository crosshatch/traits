import { Console, Effect, FileSystem, Path, String } from "effect"
import { Command } from "effect/cli"

import { getWorktreeRoot } from "../_util/Git.ts"

const configuration = String.stripMargin(`
|import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
|import { TypeSafeClient, TypeSafeDecisionModel } from "@effect/ai-typesafe"
|import { Config, Layer } from "effect"
|import type { TraitsConfig } from "traits"
|
|export default {
|  excludes: ["**/dist/**", "node_modules/**"],
|  layerDecisionModel: TypeSafeDecisionModel.layer({ model: "jev-latest" }).pipe(
|    Layer.provide(TypeSafeClient.layerConfig())
|  ),
|  layerLanguageModel: OpenAiLanguageModel.layer({
|    model: "gpt-6.1-sol",
|    config: { reasoning: { effort: "low" } }
|  }).pipe(Layer.provide(OpenAiClient.layerConfig({ apiKey: Config.Redacted("OPENAI_API_KEY") })))
|} satisfies TraitsConfig
`)

const nextSteps = String.stripMargin(`
|
|Next steps:
|
|1. Edit traits.ts to choose your decision and language models. Install the
|   provider packages imported by that file in your project.
|   Git-ignored files are excluded by default; set excludeGitignored: false
|   in traits.ts to disable the fresh Git file-set filter on each check.
|
|2. Configure your chosen providers' API keys in the MCP process environment
|   or an untracked .env at the checkout root. The default providers use
|   TYPESAFE_API_KEY and OPENAI_API_KEY. Never commit your secrets.
|
|3. Add Traits as a local MCP server in your coding agent of choice:
|   command: npx -y traits
|   working directory: the current checkout root
|   Connect the server and confirm derive_trait and check_traits are available.
|
|4. Install the bundled Traits skill from the checkout root:
|   pnpm 12.11+: pnpm add -D traits, then pnpm approve to approve its skills.
|   pnpm links into existing agent skill directories or the running agent's
|   directory. Set skills.dirs in pnpm-workspace.yaml if needed.
|   Other package managers or older pnpm: install traits locally, then run
|   npx skills add ./node_modules/traits --skill traits to choose your agents.
|   Without a local Traits dependency, run:
|   npx skills add https://github.com/crosshatch/traits/tree/main/traits/skills/traits
|   This uses the repository version; local installation uses your package's skill.
|   The skills CLI installs a snapshot; rerun after updating Traits.
|   pnpm dlx and global installs do not link skills.
|   Existing skill copies are left untouched. Back up any customizations before
|   replacing an old copy, and avoid loading both it and a package-managed skill.
`)

export const init = Command.make("init").pipe(
  Command.withHandler(
    Effect.fn("traits.init")(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* getWorktreeRoot
      const destination = path.join(root, "traits.ts")
      if (yield* fs.exists(destination)) {
        yield* Console.log(`Leaving existing "${destination}" unchanged`)
      } else {
        yield* fs.writeFileString(destination, configuration, { flag: "wx" })
        yield* Console.log(`Created "${destination}"`)
      }
      yield* Console.log(nextSteps)
    })
  )
)
