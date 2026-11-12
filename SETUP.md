# Set up Traits

Traits is configured by your coding agent, following your project's conventions.
Follow these instructions inside the consumer's Git checkout.

## Instructions for the agent

### 1. Respect consumer configuration before every package-manager operation

**Every package-manager operation must respect the consumer's specific
configuration—not merely their choice of package manager.** This applies to
dependency checks, installs, updates, and package runners, including the
examples below.

Read the project's instructions, `packageManager`, lockfiles, package manifests,
and applicable project/workspace configuration before running commands. Examples
include `pnpm-workspace.yaml`, `bunfig.toml`, `.npmrc`, and `.yarnrc.yml`;
inspect the files relevant to the consumer rather than assuming default
settings. Also review catalogs and existing agent configuration.

Preserve the configured workspace scope, dependency placement, catalogs,
overrides/resolutions, registries, authentication references, linker/hoisting
settings, and install-script/trust policies. Respect configured version and
release-age policies. Run commands from the appropriate workspace directory with
the configured package-manager version; do not bypass policies or rewrite
configuration to make installation succeed. If setup conflicts with those
settings, explain the conflict and ask before changing them. Never expose
registry credentials.

Install `traits` as a development dependency, with its peer dependencies
`effect` and `@effect/platform-node`. Reuse compatible dependencies already
supplied by the workspace; install only what is missing. Do not introduce
another lockfile, duplicate workspace dependencies, or silently upgrade an
existing Effect version. Ask before any compatibility migration.

### 2. Ask about providers and models

Ask the user which providers and models to use. Traits uses two roles:

- **decision**: classifies whether code is in a trait's subject and whether it
  satisfies the assertion. Providers: `openrouter`, `openai`, or `cloudflare`.
- **language**: free-form generation for extensions. Providers: `openrouter`,
  `openai`, `anthropic`, or `openai-compatible` (any OpenAI-compatible server,
  with a `url` and optional `apiKeyEnv`).

Offer OpenRouter as the default: one API key supplies both roles. Decision
models run on OpenRouter's Decisions API, so choose them from
`https://openrouter.ai/api/v1/models?output_modalities=decisions`.

### 3. Configure the checkout

Create `traits.json` at the checkout root, or update it while preserving
existing settings and asking before replacing them. Set `version` to the
installed Traits version:

```json
{
  "version": "0.6.0",
  "models": {
    "decision": { "provider": "openrouter", "model": "liquid/d1-ultra" },
    "language": { "provider": "openrouter", "model": "openai/gpt-6.1-sol" }
  }
}
```

Optional fields:

- `concurrency`: the maximum number of simultaneous decision requests; 16 by
  default.
- `exclude`: Git glob patterns, relative to the checkout root, for files to skip
  when every project file is checked, such as lockfiles or large generated
  assets. Git-ignored files are always skipped.

Keep `traits.json` in version control so reviewers can see which models check
the code. Traits are Markdown files in `.agents/traits/<name>.md`; environments
in `.agents/traits/_environments/<name>.json` list subsets of traits to check,
such as a faster set for CI.

### 4. Keep credentials private

Explain which credentials the selected providers require: `OPENROUTER_API_KEY`,
`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN`. Use the MCP process environment or a Git-ignored `.env`
at the checkout root. Check that the file is ignored before writing secrets;
never request secret values in chat, print them, or commit them.

Process environment values take precedence, followed by the checkout's `.env`,
then the main checkout's `.env`, so linked Git worktrees share credentials.

### 5. Connect and verify

Merge a local Traits MCP server into the current agent's existing settings,
preserving other servers. Consult the agent's current configuration format. Use
the project's package runner to launch the installed CLI's `mcp` command, with
the checkout root as the working directory. For npm, the command is
`npx traits mcp`.

The server exposes `traits.check` and `traits.derive`, and its instructions tell
the agent when to use them. `traits.derive` asks the user to approve each trait
through an MCP elicitation form, so it requires a client that supports form
elicitation. Configuration and trait files are reloaded on every call; no
restart is needed after editing them.

When credentials are available, connect the server, confirm both tools are
exposed, and check one existing source file with `traits.check`. Report manual
credential steps and blocked checks without claiming setup passed. Do not create
a trait merely to test installation.

## Command line

`traits check [paths...]` prints the report as JSON. Without paths it checks
every project file. `--trait <name>` and `--environment <name>` narrow the
traits. With a decision policy, `--fail <p> --pass <p>`, it exits 0 for Pass, 1
for Fail, 2 for Incomplete or a check that could not run, and 3 for
Inconclusive, so CI can gate on it.

`traits update` prints what changed since the workspace's `version`: the
releases to apply, oldest first. The agent performs the migration.

## Troubleshooting

### A tool or check fails

A failed check is neither a pass nor a finding. The failure message says what to
fix, such as a missing `traits.json`, missing credentials, or an invalid trait
file. Fix it and retry; configuration reloads on the next call.

### Files are too large for the decision model

A check reports an input as failed with `InvalidRequestError` when the provider
rejects the request, usually because the file exceeds the model's context. Add
the file to `exclude` in `traits.json`, or check smaller files.

### Outdated workspace

When `traits.json`'s `version` is incompatible with the installed package,
checks fail and ask for a migration. Run `traits update` and apply each listed
release to `traits.json` and the trait files, then set `version` to the latest
release.
