# Development

Run `pnpm dev` from this directory. It generates migrations for every
`src/*/schema.ts` before starting Alchemy. Each schema has its own adjacent
`migrations/` directory; no per-object Drizzle configuration is needed.

After changing a schema, restart `pnpm dev`, or run `pnpm db:generate` and
restart Alchemy. Migration SQL directories are not watched by Alchemy.

From the repository root, run `pnpm tools generate-migrations` to generate
migrations directly.

Review and commit generated SQL and snapshots alongside schema changes.
Deployments use the committed migrations: Alchemy bundles each object's SQL and
applies pending migrations when an instance activates. Migration files are
shared across stages; each instance tracks its own migration progress.
