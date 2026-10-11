import { Console, Effect, FileSystem, Path, String } from "effect"
import { Command } from "effect/cli"

import { getWorktreeRoot } from "../_util/Git.ts"

const configuration = String.stripMargin(`
|import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
|import { TypeSafeClient, TypeSafeDecisionModel } from "@effect/ai-typesafe"
|import { Config, Layer } from "effect"
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
|}
`)

const nextSteps = String.stripMargin(`
|
|Next steps:
|
|1. Edit traits.ts to choose your decision and language models. Install the
|   provider packages imported by that file in your project.
|
|2. Configure your chosen providers' API keys in the MCP process environment
|   or an untracked .env at the checkout root. The default providers use
|   TYPESAFE_API_KEY and OPENAI_API_KEY. Never commit your secrets.
|
|3. Add Traits as a local MCP server in your coding agent of choice:
|   command: npx -y traits
|   working directory: the current checkout root
|   Connect the server, confirm derive_trait and check_traits are available,
|   and make sure your agent discovers .agents/skills/traits/SKILL.md.
`)

export const init = Command.make("init").pipe(
  Command.withHandler(
    Effect.fn("traits.init")(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const root = yield* getWorktreeRoot
      const packageUrl = import.meta.resolve("traits/package.json")
      const sourceSkillPath = yield* path.fromFileUrl(new URL("./skills/traits/SKILL.md", packageUrl))
      const compiledSkillPath = yield* path.fromFileUrl(new URL("../skills/traits/SKILL.md", packageUrl))
      const skillPath = (yield* fs.exists(sourceSkillPath)) ? sourceSkillPath : compiledSkillPath
      const skill = yield* fs.readFileString(skillPath)

      yield* Effect.forEach(
        [
          { destination: path.join(root, "traits.ts"), content: configuration },
          { destination: path.join(root, ".agents/skills/traits/SKILL.md"), content: skill }
        ],
        Effect.fn("traits.init.write")(function* (file) {
          if (yield* fs.exists(file.destination)) {
            yield* Console.log(`Leaving existing "${file.destination}" unchanged`)
            return
          }

          yield* fs.makeDirectory(path.dirname(file.destination), { recursive: true })
          yield* fs.writeFileString(file.destination, file.content, { flag: "wx" })
          yield* Console.log(`Created "${file.destination}"`)
        })
      )
      yield* Console.log(nextSteps)
    })
  )
)
