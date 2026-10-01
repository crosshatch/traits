# Bootstrap CI credentials

`bootstrap.ts` provisions an account-owned Cloudflare token and stores it as the
`CLOUDFLARE_API_TOKEN` Actions secret in `harrysolovay/crosshatch-next`, alongside
the `CLOUDFLARE_ACCOUNT_ID` Actions variable. It uses Cloudflare-backed state.

Run with an Alchemy profile authenticated to Cloudflare and GitHub, with access
to create account tokens and manage the repository's Actions secrets/variables:

```sh
CLOUDFLARE_ACCOUNT_ID=<account-id> pnpm exec alchemy deploy bootstrap.ts --stage bootstrap
```

The token includes account and zone permissions in Alchemy's bundled catalog,
scoped to that account and its zones. Cloudflare forbids token-management
permissions on sub-tokens, so those are excluded. User-only APIs are outside its scope.
Reapply after catalog upgrades to pick up newly supported permissions.

GitHub workflows must expose the stored values to deployment steps:

```yaml
env:
  CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```
