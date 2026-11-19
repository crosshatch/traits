# Ingesting and applying traits

```sh
traits add ./rules --environment ci
traits add https://github.com/owner/repo/tree/main/rules --track --deep
traits pull
traits pull ci --force
traits apply
traits apply small-functions clear-names
traits apply --environment ci
traits add ./rules --apply
traits update
```

## Ingestion

`add` and `pull` persist traits without running an agent. `add` parses each file
as Markdown with YAML frontmatter, using `LanguageModel.generateObject` only
when parsing fails. One input can produce multiple traits. Directories include
their own files and immediate child directories; `--deep` includes all
descendants. GitHub sources use `@distilled.cloud/github` and `GITHUB_TOKEN` or
`GH_TOKEN`, fetching files at resolved commit SHAs and directories through trees
and blobs.

Named environments use `traits/_environments/<name>.json`. Missing environments
are created with a notice. Without `--environment`, the imported traits are not
registered in a named environment.

`--track` records remote sources only, deduplicated by reference in
`traits/_metadata.json`. Metadata includes the pinned commit, branch, source
hashes, environment, inference provenance, and installed trait hashes. Unchanged
source files reuse inferred traits. `pull` with no arguments selects remotes
without a named environment; arguments select named environments.

Local edits stop ingestion with a `LocalTraitEdits` error listing the affected
files. The calling client can ask the user what to do. After review, `--force`
on `add` or `pull` explicitly permits replacement. The store itself does not
prompt. Traits no longer produced by a tracked source are removed on refresh.

The programmatic `WritableTraitStore` is available from `traits/local`. Its
`add` and `pull` results contain `traits` (the current source selection),
`changed`, `removed`, and `environmentsCreated`. `Ingest.extract`, `scrape`, and
`parseOrExtract` remain available from the main package.

## Application

`traits apply` generates one report for the selected installed traits against
all project files selected by the workspace checker. With no names it selects
all traits; `--environment` narrows the selection. Without an agent command, it
prints the report reference and instructions for the calling agent to follow.

`add --apply` and `pull --apply` compose ingestion with application of the
source selection, including unchanged traits. If application fails, the imported
traits remain installed. Retry `traits apply` without fetching or extracting
again. There is no pending-application store.

Programmatic callers can use `WorkspaceApply.prepare` for a report and prompt,
or `WorkspaceApply.run` to execute a configured agent as well. User questions,
review pauses, and commits belong to the calling agent/client. The phased
`--interactive` workflow has been removed.

## Optional headless agent

Add this alongside version and model configuration in `traits/_config.json`:

```json
{
  "agent": {
    "command": "opencode run --session {{session}} --auto {{prompt}}",
    "continue": "opencode run --session {{session}} --auto {{prompt}}",
    "sessionPrefix": "ses_",
    "maxSteps": 5
  }
}
```

Session identities are UUIDs with an optional configured prefix; the runner has
no implicit OpenCode session format. OpenCode creates or resumes the supplied
identity, and `--auto` approves permissions not explicitly denied by its config.
Other agents supply their own start and continuation templates. Placeholders
must be complete shell arguments, optionally quoted; their values are passed
through environment variables rather than interpolated as shell syntax.

Each invocation's stdout is printed and saved to `traits/stdout/<uuid>`. A
decision model classifies completion, further work, or required user input.
Further work continues the same session, bounded by `maxSteps` (default five).
The command is instructed to state questions in its final output and stop. When
input is required, the API returns `InputRequired` with the session,
transcripts, and output; the CLI exits 2. It does not ask a language model to
answer for the user. `CodingAgent.run(config, answer, session)` resumes after
the caller obtains an answer. Step exhaustion fails with transcript references.

`update` retains its version-migration meaning. When an agent is configured and
a newer version exists, it runs the migration instructions through the same
headless runner. It also returns control when user input is required.
