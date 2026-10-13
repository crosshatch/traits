import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import { Stage } from "alchemy/Stage"
import { Effect, Layer, String } from "effect"

export default Alchemy.Stack(
  "traits.sh",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const stage = yield* Stage
    const env = yield* GitHub.GitHubEnv
    const site = yield* Cloudflare.Website.Vite("Website", {
      ...(stage === "prod"
        ? { domain: "traits.sh" }
        : env?.pr !== undefined
          ? { domain: `pr-${env.pr}.traits.sh` }
          : {}),
      rootDir: "traits.sh"
    })
    if (env !== undefined && env.pr !== undefined) {
      yield* GitHub.Comment("PreviewComment", {
        owner: env.owner,
        repository: env.repository,
        issueNumber: env.pr,
        body: site.url.pipe(
          Output.map((url) => {
            const body = String.stripMargin(`
            |### traits.sh Preview
            |
            |Commit: ${env.sha}
            |
            |URL: ${url}
            `)
            return body
          })
        )
      })
    }
    return { url: site.url.as<string>() }
  })
)
