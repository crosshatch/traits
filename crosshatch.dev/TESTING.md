# Verification

The app consumes `crosshatch` through `workspace:*`. Library tests stay in
`crosshatch/test`, library type assertions in `crosshatch/typetest`, app unit tests
in `crosshatch.dev/test/unit`, and Alchemy integration tests in
`crosshatch.dev/test/integration`.

## Commands

Run these from the workspace root:

| Command | Scope |
| --- | --- |
| `pnpm build` | Compile the library and its declarations |
| `pnpm check` | Check the library, library tests, Worker source, and app tooling/tests |
| `pnpm test` | Library and app unit tests; no deployment |
| `pnpm test:types` | TSTyche library assertions |
| `pnpm test:integration` | Real Cloudflare providers, through the integration suite |
| `pnpm verify` | Build, check, unit tests, and type assertions |
| `pnpm verify:live` | Verification followed by the live integration suite |

Only configuration exists so far. Unit suites permit empty discovery during
scaffolding. TSTyche and integration suites intentionally fail when empty, so
`verify` cannot finish until library type tests exist. Deployment and migration
commands also require the future `alchemy.run.ts` and `src/schema.ts` files.

## TypeScript environments

- `../crosshatch/tsconfig.json` retains NodeNext/ES2022 and library emission.
- `tsconfig.json` checks Worker source with Preserve/Bundler resolution,
  Cloudflare types through `compilerOptions.types`, `lib: ["ESNext"]`, and no
  emission. `files: []` allows the project to remain empty until source is added.
- `tsconfig.tools.json` checks the Alchemy entry, Drizzle/Vitest configuration,
  and tests. It also includes application source because deployment tests import
  the actual stack. Node and Cloudflare types are both available in this host
  project. For config paths, use `dirname(fileURLToPath(import.meta.url))` to
  avoid the conflicting Node and Cloudflare `URL` types.
- Both app projects reference the library. The root solution builds/checks them
  without pulling in vendored repositories.

## Integration runner contract

Use `alchemy/Test/Vitest` and `@effect/vitest`, not Alchemy's private
`alchemy-test` runner. Integration tests execute on Node and exercise a real
Cloudflare deployment.

The integration configuration sets `ALCHEMY_TEST_DEV` and `ALCHEMY_DEV` to
`false` to select live providers. Use `Test.make`'s mode resolution.
`ALCHEMY_PROFILE` defaults to `testing` and can be overridden
in the invoking environment. These variables are provided to test workers via
Vitest's `test.env`; they are not exported into the calling shell or global setup.

The integration configuration fixes:

- Node test environment and explicit integration-only discovery.
- One worker, sequential files/tests, and no whole-test retries.
- `sequence.hooks: "list"` so Alchemy's fallback scope cleanup runs after
  the suite's registered destroy hook.
- 120-second tests, 180-second hooks, and a 30-second runner teardown budget.
- `NO_DESTROY` to an empty value so upstream-style conditional teardown remains
  enabled.

Alchemy's adapter supplies its own default hook timeout. Pass `{ timeout:
180_000 }` to its deployment and destruction hooks to use the configured budget.
Vitest's runner teardown timeout is not the cloud-resource deletion timeout.

Always launch via the package scripts. They run with `crosshatch.dev` as the
actual working directory, which Alchemy uses to resolve migrations and state.
The root scripts delegate to the app package to establish this working directory.

## Stage and state ownership

An explicit `ALCHEMY_TEST_STAGE` takes precedence. Otherwise stages are:

- Local shell: `test-<user>-<app-directory-hash>-live`.
- GitHub Actions: `test-<run-id>-<attempt>-live`.
- Other CI: an explicit `ALCHEMY_TEST_STAGE` is required.

For matrix jobs/shards, supply a stage including the matrix/shard identifier.
Keep the same explicit stage available to deployment, tests, and cleanup:

```sh
ALCHEMY_PROFILE=testing ALCHEMY_TEST_STAGE=test-my-worktree-live pnpm test:integration
```

Do not override `stage` inconsistently in individual `Test.make`/deploy/destroy
calls. Alchemy's test stage is separate from the CLI's `ALCHEMY_STAGE`.

Use a prebootstrapped `Cloudflare.state()` backend for integration tests.
Configure the same state backend in
the application stack and the test harness. The state-store infrastructure
persists between test deployments.

Cloudflare CI credentials come from `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`; local runs can use an authenticated Alchemy profile.
OpenCode's Cloudflare MCP authentication is separate from Alchemy authentication.

## Lifecycle for future suites

1. Import the real app stack from `alchemy.run.ts` and register teardown before
   any asynchronous deployment work starts.
2. Destroy stale resources belonging to that exact test stack/stage, then deploy
   once in `beforeAll`. Share its resolved outputs across the suite.
3. Poll a read-only readiness endpoint with a bounded schedule and deadline.
   Validate the expected application JSON/deployment marker, not HTTP status
   alone: newly deployed Workers can return placeholder HTML with status 200.
4. Exercise HTTP -> Worker -> Durable Object -> Drizzle -> SQLite. Use distinct
   object names per independent test. Do not retry non-idempotent mutations as
   readiness probes.
5. Destroy in `afterAll`, including after assertion/setup failures. Surface
   cleanup errors and verify the test resources are gone. Closing an Effect
   scope alone is not equivalent to destroying a cloud stack.
6. In CI, also run an unconditional cleanup step with the same stack, stage,
   profile, and state backend. Preserve deployment identifiers/logs for recovery
   if the runner is terminated before hooks can finish.

The runner configuration does not itself provision or destroy resources. Those
hooks belong to the future test suite. Begin with one deployment-owning suite;
multiple suites must use distinct stack identities or one shared lifecycle owner.

For manual live cleanup once the application stack exists:

```sh
pnpm --filter crosshatch.dev destroy --stage test-my-worktree-live --profile testing
```

Use that explicit CLI stage; the CLI does not infer `ALCHEMY_TEST_STAGE`.
Avoid account-wide teardown as a normal test operation.

## SQLite migrations

`drizzle.config.ts` targets `src/schema.ts` and writes SQLite migrations to
`drizzle/`. Generate with `pnpm --filter crosshatch.dev db:generate`, review and
commit the SQL, and check its consistency with `db:check`. Do not regenerate
migrations during CI deployment. There is no D1 database provisioning or remote
`drizzle push` step for Durable Object SQLite.

Once the Alchemy release supports it, capture `Cloudflare.SqlMigrations` during
construction and apply it through `Drizzle.DurableObject` during activation.
Deployment does not eagerly migrate every object. Keep an upgrade test that
deploys an older schema, writes data, redeploys the new schema to the same stage,
and checks preservation before teardown; fresh-database tests cannot prove this.

## Dependency status

Alchemy is pinned to `2.0.0-beta.79`; Effect, its Node platform, and its Vitest
adapter are aligned at `4.0.0-rc.118`. Drizzle ORM/Kit share the version expected
by Alchemy. Dependencies are installed from the registry, not `repos/`.

The pinned Alchemy release still imports removed `effect/unstable/*` paths and
does not yet ship the checkout's `Cloudflare.SqlMigrations`. Runtime integration
is pending the upstream compatibility fix. There are no compatibility aliases
or patches to hide this. Its transitive `capnp-es` also declares a TypeScript
5/6 peer range while this workspace uses TypeScript 7.

The scoped `packageExtensions` entry supplies the missing test-adapter peer
declarations in this Alchemy release. Reassess it when upgrading Alchemy.

Reference patterns live under `../repos/alchemy-run/alchemy-effect/`, especially
`examples/cloudflare-durable-object-sql` and `packages/alchemy/src/Test/Vitest.ts`.
