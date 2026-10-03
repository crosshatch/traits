# Development

From the repository root, run `pnpm tools generate-migrations` after changing a
schema. It generates migrations for every `crosshatch.dev/src/*/schema.ts`,
using an adjacent `migrations/` directory for each schema. No per-object Drizzle
configuration is needed.

Run `pnpm dev` from this directory to start Alchemy. Restart it after generating
migrations; migration SQL directories are not watched by Alchemy.

Review and commit generated SQL and snapshots alongside schema changes.
Deployments use the committed migrations: Alchemy bundles each object's SQL and
applies pending migrations when an instance activates. Migration files are
shared across stages; each instance tracks its own migration progress.
