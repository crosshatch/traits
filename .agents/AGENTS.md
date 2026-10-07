# Project Guidelines

All paths below are relative to the repository root.

## Workspace

- `crosshatch/`: published library.
- `crosshatch.dev/`: Cloudflare application using Alchemy, Workers, Durable Objects, and Drizzle.
- Use pnpm and Node-compatible tooling; do not introduce Bun APIs.
- Use `pnpm --filter crosshatch.dev dev` (`alchemy dev`) for development and `pnpm --filter crosshatch.dev exec alchemy deploy` for cloud deployments. Dev mode uses local providers where supported and live resources otherwise; resources marked `Alchemy.remote()` also use live providers. Do not assume a dev run is entirely local or credential-free.

## Learning from Feedback

- When the user corrects your approach or expresses a reusable coding preference, load the traits skill and check existing traits across all configured groups. If the insight is durable and not already covered, proactively call `create-trait` with the destination group, proposed filename, full text, and review target; the server requests approval through MCP elicitation before saving. Do not ask separately first or wait for the user to mention traits. Follow the skill's group selection, revision, and unsupported-client approval fallback instructions. Skip one-off task requirements.

## Drizzle Migrations

- Whenever Drizzle schemas change, run `pnpm run tasks generate-migrations` from the repository root.

## Verification

- Run checks from the root: `pnpm exec vp check` for formatting/lint/types; `pnpm build` after TypeScript changes (`--force` after config changes).
- Run affected suites: `pnpm test:lib` for library behavior, `pnpm test:types` for public API types, and `pnpm test:integration` for app behavior. `pnpm test` runs all checks, builds, and suites; docs-only edits need no build/tests.
- After dependency changes, run `pnpm install`; after exports/publishing changes, run `pnpm --filter crosshatch pack` and verify the tarball's imports/types in a consumer.
- The current integration suite deploys real Cloudflare resources. Require credentials/profile and initialized state, set a unique `ALCHEMY_TEST_STAGE`, and verify teardown. Tests configured with `Test.make({ dev: true })` use dev-mode providers and can still provision live resources. If interrupted, run `pnpm --filter crosshatch.dev exec alchemy destroy --stage <same-stage>` with the same profile.
- Report failures, blocked checks, and empty/skipped suites accurately.

## Debugging with Axiom

Use the Axiom MCP to query:

- Logs: `crosshatch-<stage>-logs`
- Traces: `crosshatch-<stage>-traces`

If authentication is required, ask the user to sign in via `/mcps` → **axiom**.

### Find the stage

Use the stage from the command/environment that ran the application or test:

- Development (`alchemy dev`): `--stage` → `ALCHEMY_STAGE` → `dev_<user>`.
- Cloud deployment (`alchemy deploy`): `--stage` → `ALCHEMY_STAGE` → `live_<user>`.
- Tests: explicit test stage override → `ALCHEMY_TEST_STAGE` → `test_<user>`;
  independently of `ALCHEMY_STAGE`.
- Production: explicitly `--stage prod`.

Stage names identify isolated stack instances; their prefixes do not select
execution mode. `live_` does not mean production, and `dev_` can contain both
local and live resources, including real Axiom datasets. Test stage selection
is independent of whether the test uses live or dev-mode providers. Keep dev
and deployed stages distinct: switching provider modes within one stage can
replace resources.

Dataset names are defined in `crosshatch.dev/src/Ingest.ts` using the stack name and stage.

### Query

Select the stage-specific dataset and a time range covering the reproduction.
For example:

```kusto
['crosshatch-dev_harry-logs']
| where _time > ago(15m)
| order by _time desc
| take 100
```

Use the matching `-traces` dataset for request spans. Inspect dataset schemas
through MCP before filtering attributes or correlating logs and spans by trace
ID; Axiom normalizes OTel fields. Alchemy exports `alchemy.stack` and
`alchemy.stage` as resource attributes.

Integration test teardown deletes the stage's datasets and their contents.
Query/export evidence before teardown, or reproduce in a development stage.

## CI Credentials

- Whenever deployment configuration changes or new environment variables are introduced, update `bootstrap.ts` to provision the required GitHub Actions secrets/variables, rerun bootstrap, and expose them in the workflow's deployment environment before deploying from CI.
- Bootstrap with `CLOUDFLARE_ACCOUNT_ID=<account-id> pnpm exec alchemy deploy bootstrap.ts --stage bootstrap`, using an Alchemy profile authorized to create Cloudflare account tokens and manage GitHub Actions secrets/variables.
- Deployment steps must expose `CLOUDFLARE_API_TOKEN` from `${{ secrets.CLOUDFLARE_API_TOKEN }}` and `CLOUDFLARE_ACCOUNT_ID` from `${{ vars.CLOUDFLARE_ACCOUNT_ID }}`.

## Reference Repositories

- Treat submodules under `repos/` as read-only unless explicitly asked to modify them.
- Prefer relevant source, tests, and examples over guesses or web searches.
- Import normal package dependencies, never vendored source.
- For Effect patterns and API design, consult `repos/Effect-TS/effect/`.
- For Alchemy application and deployment patterns, consult `repos/alchemy-run/alchemy-effect/examples/`.

## Effect

- Library code under `crosshatch/` must use `Effect.fnUntraced` instead of `Effect.fn`.
- Aside from in library code (`crosshatch/`), always use `Effect.fn` with a concise span name: `Effect.fn("<name>")(function* () { ... })` rather than `Effect.fn(function* () { ... })`.
- Prefer `Effect.fn` / `Effect.fnUntraced` over functions that only return `Effect.gen`, including callbacks such as `items.map(Effect.fn("processItem")(function* (item) { ... }))`.
- Apply transformations through additional function arguments to the wrapper. These receive the effect and the original arguments, so argument-dependent services do not require an outer arrow function:

  ```ts
  const process = Effect.fn("process")(
    function* (item: Item) {
      /* ... */
    },
    (effect, item) => Effect.provideService(effect, TheService, item)
  )
  ```

  Use the same form with `Effect.fnUntraced` in library code, without a span name.

- An outer callback returning `Effect.gen(...).pipe(...)` is appropriate when it needs to capture callback-local values for the pipeline, e.g. `(item) => Effect.gen(function* () { ... }).pipe(Effect.provide(outerThing))`. Merely referencing an outer value does not require this exception: prefer a wrapper transformation when it can capture that value directly.

## Layer Naming

- When a module's primary layer represents its core service, export it as `layer`.
- Include the service or role only when the module exports multiple layers and `layer` alone would not identify what each provides.
- Add implementation or backend qualifiers after the service or role.
- When a layer is constructed from a particular input source, append `From<InputSource>`.

```ts
// Module's core service
layer
layerFromConfig
layerFromEnv

// Multiple services or roles in one module
layerFoo
layerFooFromConfig
layerFooFromEnv

layerStoreRedis
layerStoreRedisFromConfig
```

General forms:

```text
layer[FromInputSource]
layer<ServiceOrRole>[Implementation][FromInputSource]
```

Avoid `XLive`, `XLayer`, `layerFooConfig`, and `layerFooEnv`.

## Configuration

Keep configuration minimal and deliberate: verify defaults, remove duplication, and avoid speculative abstractions.
