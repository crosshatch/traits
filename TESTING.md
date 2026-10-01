# Verification

This guide covers both workspace packages. Paths are relative to the repository
root unless otherwise noted.

The app consumes `crosshatch` through `workspace:*`. Library tests stay in
`crosshatch/test`, library type assertions in `crosshatch/typetest`, and live
Alchemy integration tests in `crosshatch.dev/test`.

## Commands

Run these from the workspace root:

| Command | Scope |
| --- | --- |
| `pnpm build` | Type-check all workspace projects and emit the library and its declarations |
| `pnpm check` | Same TypeScript project build as `pnpm build` |
| `pnpm test` | Full verification, including live Cloudflare integration tests |
| `pnpm test:library` | Library runtime tests only |
| `pnpm test:types` | TSTyche library assertions |
| `pnpm test:integration` | Real Cloudflare providers, through the integration suite |

Only configuration exists so far. The library suite permits empty discovery during
scaffolding. TSTyche and integration suites intentionally fail when empty, so
`pnpm test` cannot finish until library type tests exist. Deployment and migration
commands also require the future `crosshatch.dev/alchemy.run.ts` and
`crosshatch.dev/src/schema.ts` files.

## Library tests (`crosshatch`)

### Runtime behavior

Put Vitest tests in `crosshatch/test/**/*.test.ts`. `crosshatch/vitest.config.ts`
discovers these files. The library's package exports resolve to source, so
tests exercise current source without requiring a published package.

Use these tests for library behavior, validation, and failure cases. Supply
test implementations for external services so the library suite runs without
Cloudflare credentials or deployments. Verify the real Cloudflare integration
through the app's integration suite.

Run `pnpm test:library` for this suite.

### Public API types

Put TSTyche assertions in `crosshatch/typetest/**/*.test.ts`, as configured by
`tstyche.json`. Use them to verify inferred types, generic relationships, and
rejected usage of the public API. Run them with `pnpm test:types`.

`tsconfig.node.json` also checks library test files, references the library
project, and supplies Node types. Ordinary `pnpm check` catches TypeScript
errors; the TSTyche command evaluates the dedicated type assertions.

### Build and publishing

`pnpm build` checks all workspace projects and emits the library's JavaScript, declarations, and maps into
`crosshatch/dist`. The release configuration enables `stripInternal` when the
package is packed. `prepack` forces a release rebuild. Publishing assumes a fresh
CI checkout so obsolete output cannot enter the package. To inspect the artifact
without publishing:

```sh
pnpm --filter crosshatch pack --pack-destination /tmp/opencode/crosshatch-pack
```

Source-based tests do not validate the packed export map or declaration files.
Include a packed-package consumer check when introducing public APIs or changing
publishing configuration. The app consumes the library through `workspace:*`,
so deployed app tests additionally exercise its code inside the Worker bundle.

## TypeScript environments

- `crosshatch/tsconfig.json` retains NodeNext/ES2022 and library emission.
- `crosshatch.dev/tsconfig.json` checks Worker source, the Alchemy entry,
  Drizzle/Vitest configuration, and tests together with Preserve/Bundler
  resolution, `lib: ["ESNext"]`, and no emission. Node and Cloudflare types are
  both available through `compilerOptions.types`, matching the combined app
  layout used by Alchemy's examples. For config paths, use
  `import.meta.dirname` (Node 20.11+) to
  avoid the conflicting Node and Cloudflare `URL` types.
- The app project references the library. The root solution builds/checks both
  without pulling in vendored repositories.

## App integration runner contract (`crosshatch.dev`)

`crosshatch.dev/vitest.config.ts` defines one suite covering
`test/**/*.test.{ts,tsx}`. The app's `test` script runs `vitest run`; the root
`test:integration` script delegates to it. Empty discovery fails.

Use `alchemy/Test/Vitest` and `@effect/vitest`, not Alchemy's private
`alchemy-test` runner. Integration tests execute on Node and exercise a real
Cloudflare deployment. Use Node-compatible APIs and `@effect/platform-node`;
do not copy `bun:test`, `alchemy/Test/Bun`, or Bun APIs from upstream examples.

The integration configuration sets `ALCHEMY_TEST_DEV` and `ALCHEMY_DEV` to
`false` to select live providers. Use `Test.make`'s mode resolution.
Select an Alchemy profile using `ALCHEMY_PROFILE` in the invoking environment;
otherwise Alchemy uses its default profile. The live-mode flags reach workers via
Vitest's `test.env`; they are not exported into the calling shell or global setup.

The integration configuration fixes:

- Node test environment and explicit integration-only discovery.
- One worker, sequential files/tests, and no whole-test retries.
- `sequence.hooks: "list"` so Alchemy's fallback scope cleanup runs after
  the suite's registered destroy hook.
- 120-second tests and 180-second hooks.

Alchemy's adapter supplies its own default hook timeout. Pass `{ timeout:
180_000 }` to its deployment and destruction hooks to use the configured budget.
Vitest's runner teardown timeout is not the cloud-resource deletion timeout.

Always launch via the package scripts. They run with `crosshatch.dev` as the
actual working directory, which Alchemy uses to resolve migrations and state.
The root scripts delegate to the app package to establish this working directory.

## Stage and state ownership

Alchemy uses `ALCHEMY_TEST_STAGE`, falling back to `test_$USER` (or
`test_$USERNAME` / `test_unknown`). The Vitest configuration does not generate
stage names or validate CI environment variables. Supply an explicit stage for
concurrent worktrees and CI, including the run and attempt identifiers.

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

1. Import the real app stack from `crosshatch.dev/alchemy.run.ts` and register teardown before
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
pnpm --filter crosshatch.dev exec alchemy destroy --stage test-my-worktree-live --profile testing
```

Use that explicit CLI stage; the CLI does not infer `ALCHEMY_TEST_STAGE`.
Avoid account-wide teardown as a normal test operation.

## SQLite migrations

`crosshatch.dev/drizzle.config.ts` targets `crosshatch.dev/src/schema.ts` and
writes SQLite migrations to `crosshatch.dev/migrations/`.
Generate with `pnpm --filter crosshatch.dev exec drizzle-kit generate`, review and
commit the SQL, and check its consistency with `pnpm --filter crosshatch.dev exec drizzle-kit check`. Do not regenerate
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

`patches/effect@4.0.0-rc.118.patch` temporarily restores the old
`effect/unstable/*` paths used by Alchemy and its dependencies, including the
`httpapi` rename, and provides `effect/Encoding` compatibility exports and types.
Aliases reuse current Effect modules. pnpm applies the patch on installation;
remove it once Alchemy and its dependencies migrate to the current APIs.
Node imports, representative declaration resolution, encoding behavior, and a
Worker-condition browser bundle have been checked; live deployment remains
unverified.

Alchemy does not yet ship the checkout's `Cloudflare.SqlMigrations`. Its transitive
`capnp-es` declares a TypeScript 5/6 peer range while this workspace uses TypeScript 7.

The scoped `packageExtensions` entry supplies the missing test-adapter peer
declarations in this Alchemy release. Reassess it when upgrading Alchemy.

Reference patterns live under `repos/alchemy-run/alchemy-effect/`, especially
`examples/cloudflare-durable-object-sql` and `packages/alchemy/src/Test/Vitest.ts`.
