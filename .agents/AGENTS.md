# Project Guidelines

All paths below are relative to the repository root.

## Workspace

- `crosshatch/`: published library.
- `crosshatch.dev/`: Cloudflare application using Alchemy, Workers, Durable Objects, and Drizzle.
- Use pnpm and Node-compatible tooling; do not introduce Bun APIs.
- See `TESTING.md` for verification commands. App integration tests deploy and target live Cloudflare deployments.

## Reference Repositories

- Treat submodules under `repos/` as read-only unless explicitly asked to modify them.
- Prefer relevant source, tests, and examples over guesses or web searches.
- Import normal package dependencies, never vendored source.
- For Effect patterns and API design, consult `repos/Effect-TS/effect/`.
- For Alchemy application and deployment patterns, consult `repos/alchemy-run/alchemy-effect/examples/`.

## Configuration

Keep configuration minimal and deliberate: verify defaults, remove duplication, and avoid speculative abstractions. Use `.agents/skills/prune-configuration/SKILL.md` when auditing configuration.
