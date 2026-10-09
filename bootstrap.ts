import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import { Array, Config, Effect, Layer, pipe } from "effect"

const repository = { owner: "crosshatch", repository: "traits" }

const permissionGroups = (scope: string) =>
  pipe(
    Cloudflare.ApiToken.PERMISSION_GROUPS,
    Array.filter((group) => Array.some(group.scopes, (value) => value === scope)),
    // Cloudflare forbids token-management permissions on sub-tokens.
    Array.filter(
      (group) =>
        group.id !== "eb56a6953c034b9d97dd838155666f06" && // Account API Tokens Read
        group.id !== "5bc3f8b21c554832afc660159ab75fa4" // Account API Tokens Write
    ),
    Array.map((v) => ({ id: v.id }))
  )

export default Alchemy.Stack(
  "traits-bootstrap",
  {
    state: Cloudflare.state(),
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers())
  },
  Effect.gen(function* () {
    const accountId = yield* Config.NonEmptyString("CLOUDFLARE_ACCOUNT_ID")
    const account = `com.cloudflare.api.account.${accountId}`

    const token = yield* Cloudflare.ApiToken.AccountApiToken("GitHubDeployToken", {
      accountId,
      policies: [
        {
          effect: "allow",
          permissionGroups: permissionGroups("com.cloudflare.api.account"),
          resources: { [account]: "*" }
        },
        {
          effect: "allow",
          permissionGroups: permissionGroups("com.cloudflare.api.account.zone"),
          resources: { [account]: { "com.cloudflare.api.account.zone.*": "*" } }
        }
      ]
    })

    yield* GitHub.Variables({
      ...repository,
      variables: {
        CLOUDFLARE_ACCOUNT_ID: accountId
      }
    })
    yield* GitHub.Secrets({
      ...repository,
      secrets: {
        CLOUDFLARE_API_TOKEN: token.value
      }
    })
  })
)
