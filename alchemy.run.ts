import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import { Effect, Layer, String } from "effect"

export default Alchemy.Stack(
  "traits.sh",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const site = yield* Cloudflare.Website.Vite("Website", { rootDir: "traits.sh" })
    const env = yield* GitHub.GitHubEnv
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
