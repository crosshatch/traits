import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"

export default Alchemy.Stack(
  "traits.sh",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state()
  },
  Effect.gen(function* () {
    const site = yield* Cloudflare.Website.Vite("Website", { rootDir: "traits.sh" })
    return { url: site.url.as<string>() }
  })
)
