---
"traits": minor
"@traits/typescript": minor
---

Rebuild Traits around workspace checks: traits gate each file on its subject
before assessing the assertion, checks run from the CLI and MCP with full
reports, and traits are saved only after the user approves them in a form. To
migrate a workspace:

- Replace `traits.ts` with `traits.json` at the checkout root:
  `{ "version": "0.6.0", "models": { "decision": { "provider", "model" }, "language": { "provider", "model" } } }`.
  Decision providers are `openrouter`, `openai`, and `cloudflare`; language
  providers are `openrouter`, `openai`, `anthropic`, and `openai-compatible`
  (with `url` and optional `apiKeyEnv`). Credentials come from
  `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or
  `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`, in the environment or a
  Git-ignored `.env`. Rename `decisionConcurrency` to `concurrency` and
  `excludes` to `exclude` (Git glob patterns, relative to the checkout root).
  Remove `excludeGitignored` and `fileReadConcurrency`; Git-ignored files are
  always skipped. Delete `traits.ts`, and remove provider packages installed
  only for it.
- In each `.agents/traits/<name>.md`, rename the `requirement` frontmatter key
  to `assertion`, and fold `applicability` into `subject` as its scope and
  exceptions. Unknown keys are rejected. The Markdown body remains supporting
  context.
- Delete `.agents/traits/traits.sqlite*` and their entries in
  `.agents/traits/.gitignore`; traits are read from their Markdown files.
- Remove `// traits-ignore-file` directives, which are no longer honored; add
  files that should never be checked to `exclude` instead.
- Change the agent's Traits MCP server command to `traits mcp`, for example
  `npx traits mcp`. The tools are now `traits.check` and `traits.derive`.
  `traits.check` takes explicit `paths` (no globs; omit them to check every
  project file), optional `traits`, and an optional `environment` from
  `.agents/traits/_environments/<name>.json`. `traits.derive` takes complete
  trait files in `traits` and asks for approval through an MCP form, so it
  requires a client that supports form elicitation; there is no `approved`
  parameter.
- Remove installed copies of the bundled `traits` skill, such as
  `.agents/skills/traits` and `.claude/skills/traits`, and unlink
  package-managed skills; the server's instructions replace it.
- The reflection server and its telemetry database are removed.
- `traits check [paths...]` checks from the command line and, with
  `--fail <p> --pass <p>`, exits 0 for Pass, 1 for Fail, 2 for Incomplete, and 3
  for Inconclusive. `traits update` prints these migration steps for later
  releases.
- `@traits/typescript/package-exports` is a new enrichment that tells
  assessments whether a file is a package entry point.
