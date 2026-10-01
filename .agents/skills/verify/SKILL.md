---
name: verify
description: Choose and run checks to verify workspace changes, including builds, library tests, type assertions, and live Cloudflare integration tests.
---

# Verify

Run commands from the repository root. Choose checks relevant to the change;
documentation-only edits do not require builds or tests.

| Command | Purpose |
| --- | --- |
| `pnpm build` | Type-check all projects and emit the library |
| `pnpm test:lib` | Library runtime tests in `crosshatch/test` |
| `pnpm test:types` | Public API type assertions in `crosshatch/typetest` |
| `pnpm test:integration` | Deploy, test, and destroy the real Cloudflare app |
| `pnpm test` | Build and run all suites, including live integration |

- Run `pnpm build` after TypeScript changes; use `pnpm build --force` when
  configuration changes or stale incremental output could hide errors.
- Run the affected suites. Empty library discovery currently passes; empty
  type/integration suites fail. An empty suite does not verify behavior.
- For dependency changes, update the lockfile with `pnpm install`.
- For public exports or publishing changes, pack and check imports/types from a
  consumer project. Source-based tests do not validate the published package:

  ```sh
  pnpm --filter crosshatch pack --pack-destination /tmp/opencode/crosshatch-pack
  ```

## Live integration

- Use the package script so Alchemy runs from `crosshatch.dev`.
- Provide Cloudflare credentials (`CLOUDFLARE_ACCOUNT_ID` and
  `CLOUDFLARE_API_TOKEN`) or an authenticated `ALCHEMY_PROFILE`, and a
  bootstrapped `Cloudflare.state()` backend.
- Set `ALCHEMY_TEST_STAGE` explicitly for worktree/CI isolation. Keep the same
  stage, profile, and state backend for deployment and cleanup:

  ```sh
  ALCHEMY_TEST_STAGE=test-my-worktree pnpm test:integration
  ```

- Follow `crosshatch.dev/test/health.test.ts`: use `alchemy/Test/Vitest`, deploy
  in `beforeAll`, and destroy in `afterAll`, including after failures. Tests use
  real Cloudflare providers, not local emulation.
- Use bounded readiness retries and assert response content, not status alone.
  Verify teardown; closing an Effect scope does not destroy cloud resources.
- If interrupted, clean up only the test stack with its explicit stage:

  ```sh
  pnpm --filter crosshatch.dev exec alchemy destroy --stage test-my-worktree
  ```

  The CLI does not infer `ALCHEMY_TEST_STAGE`. Pass `--profile` if needed.

Report which checks passed, failed, or were blocked. Do not present skipped or
empty suites as executed tests, or suppress failures just to get a green result.
