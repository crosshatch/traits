import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import { Config, Effect, Layer } from "effect"

const repository = { owner: "harrysolovay", repository: "crosshatch-next" }

const permissionGroups = (scope: string) =>
  Cloudflare.ApiToken.PERMISSION_GROUPS.filter((group) => group.scopes.some((value) => value === scope))
    // Cloudflare forbids token-management permissions on sub-tokens.
    .filter(
      ({ id }) =>
        id !== "eb56a6953c034b9d97dd838155666f06" && // Account API Tokens Read
        id !== "5bc3f8b21c554832afc660159ab75fa4" // Account API Tokens Write
    )
    .map(({ id }) => ({ id }))

export default Alchemy.Stack(
  "crosshatch-bootstrap",
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
