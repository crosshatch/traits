---
name: traits
description: >-
  Use when the user corrects an approach, expresses a reusable coding
  preference, approves an alternative idiom, or asks to remember a convention;
  when reconciling conflicting traits; and after generating or editing
  TypeScript files or before committing them.
---

# Traits

Traits are concise, durable coding rules. The filesystem implementation stores
each body in `.agents/traits/<name>-<uuid>.md`, relative to its working
directory. Frontmatter contains a descriptive kebab-case `name` without a
redundant `trait-` prefix and a stable UUID `id`. The UUID alone is the
canonical identity across backends: use it for focused
`check_traits({ traitIds: [...] })` selections, not a name or filename. Ignore
directives accept UUIDs or exact trait names. Renaming preserves identity; names
need not be unique. Generate new UUIDs with `Crypto` outside the storage
adapter, validate them with `Trait.TraitId.make`, and construct records with the
schema's `Trait.Trait.make`. Preserve supplied IDs for updates and migrations;
schema construction itself does not generate IDs. `TraitStore` persists complete
traits and uses UUIDs for get, update, and remove, so other implementations can
key records directly by ID without filesystem conventions. Only the filesystem
adapter builds `<name>-<uuid>.md` paths.

Keep frontmatter fields complementary. `mime` restricts file types; `when`
defines positive semantic scope. Write `when` values without a leading "When",
such as `when: editing React state`. Add `skip` only for an independent
exception inside that scope, not for its negation or a restriction already
expressed by another field. For example,
`when: importing from local project modules` already excludes external packages;
do not repeat that as a skip. Leave unnecessary optional fields absent. Keep the
body concise and standalone, preserving essential scope and exceptions without
repeated restatements. Reuse existing traits that already cover the same rule
rather than creating duplicates.

## Capture a reusable insight

### Required pre-response preference check

Before finishing a response to a correction, preference, or approved alternative
idiom, evaluate the exchange for a reusable rule. Read the conversation across
turns: "Can we use the case guard?" followed by "Excellent. Please do"
establishes a candidate preference even without the words "always", "prefer", or
"trait".

Err on the side of proposing a concise trait unless you have read an existing
trait that clearly covers the exact rule and scope. Do not silently assume a
broad convention covers a specific idiom. If coverage is uncertain, propose the
rule; if an existing rule needs clearer wording, propose a clarification. Skip
only clearly one-off requests, transient facts, or rules you can identify as
already covered.

When coverage is uncertain, call `derive_trait` with the specific preference; do
not skip capture because a broad trait or a combination of general traits seems
related. Let the tool assess coverage or clarification. For example, “prefer
Effect utilities” and “pass callbacks directly” are not sufficient grounds to
skip proposing “prefer native inline checks and use Effect predicate helpers
directly in callbacks or existing pipelines.”

Call `derive_trait` with the drafted rule and a descriptive kebab-case `name`
first, leaving `approved` unset. Do not ask for approval separately before
invoking: capable clients receive a native MCP form. Only if `ApprovalRequired`
is returned, show the complete message in the interactive question tool with
**Save trait**, **Revise**, and **Skip** and its automatic free-text option. Do
not add a duplicate "Other" option. Use plain text only if that UI is
unavailable. Approval to edit code alone does not approve persisting a trait:
make the requested edit and propose the reusable rule before the final response.
Do not stop after implementing an idiom and running code checks; preference
capture is a separate responsibility.

### Shared approval protocol

`derive_trait` uses `_util/Approval.request` for creation, clarification, and
reconciliation. Clients with usable MCP form elicitation receive
approve/revise/skip choices and an optional feedback field. OpenCode currently
routes native forms globally, so the helper returns `ApprovalRequired`; clients
without form support use the same fallback.

On `ApprovalRequired`, show its complete message in the interactive question UI
with Save/Revise/Skip and free text. Save permits retrying the identical body
and target IDs with `approved: true`. Revision or free-text input requires
drafting the changed proposal and asking approval again, not silently setting
approved. Skip means stop. Native `RevisionRequired` and `Declined` have the
same meanings. Transport errors are failures, never declines or approvals.

Selecting **Revise** is not approval and does not cancel the proposal. If no
specific revision feedback was supplied, immediately ask what wording, scope, or
exception the user wants changed using the interactive question tool with
free-text input. Do not guess a revision or retry the mutation with
`approved: true`. Native `RevisionRequired` without actionable feedback follows
the same procedure.

Keep the original proposal and its pending revision in the conversation until
the user approves a replacement or explicitly skips/cancels it. A related audit,
code change, or follow-up question does not silently resolve the pending choice:
complete that work and then return to the revision request. If that request
already supplies the desired change, incorporate it, present the complete
revised proposal through the approval flow, and obtain fresh approval. Do not
finish by only reporting an audit while forgetting the pending proposal.

The fallback approval flag applies to creation, clarification, and resolution.
It does not bypass relationship checks or suppress native forms on capable
clients. Pending, revision, and decline outcomes never write files. Resolution
approval covers the displayed originals, their deletion, the proposal, and
model-generated reconciliation; inspect returned replacements after saving. The
flag relies on the agent honoring exact user approval; it is not an
authenticated consent token.

1. Notice user corrections and recurring preferences without waiting for an
   explicit mention of traits. Also handle explicit requests to remember a rule.
2. Distinguish a durable convention from a one-off task, transient fact, or
   vague reaction. Read existing traits and reuse covered rules rather than
   duplicating them. Clarify ambiguous scope before drafting.
3. Draft the complete rule as `proposedTrait`. Preserve essential requirements,
   scopes, and exceptions. Keep independently applicable rules separate; omit
   headings, repetition, and unnecessary explanation or examples.
4. Call `derive_trait({ name, proposedTrait })` first, without a separate
   approval prompt. This checks existing traits and writes only when the
   proposal is distinct from all of them. It does not independently decide
   whether the conversation contains a generalizable insight.
5. `Created` means the trait was saved and includes its body, name, and UUID. Do
   not submit it again. Use that UUID for focused checks when needed.
6. `Inconclusive` means nothing was saved and contains relationship findings;
   each finding's `reason` distinguishes conflict from inconclusive. Any
   inconclusive comparison blocks all writes. Inspect the existing bodies and
   names, clarify ambiguity, or revise the proposal. Confirmed conflicts
   otherwise enter approval-gated reconciliation within this same tool.

`Covered.traits` requires an independent second decision-model check of the
saved body and when, mime, and skip metadata against the entire proposal.
Partial overlap or similar intent is insufficient. Verified coverage gaps enter
approval-gated reconciliation, including needed applicability updates;
inconclusive verification blocks writes. `Covered.traits` means existing traits
already express the proposal; reuse them without creating a duplicate. When
there is exactly one clarification candidate and no covered or blocking result,
the tool selects it automatically and requests approval of its current body and
complete replacement. The proposal must preserve the existing rule's intent,
requirements, scope, and exceptions; the tool does not generate a merged
replacement from an incremental hint.

Multiple candidates return `Clarification` with `traits` and `proposedTrait`
without writing. Refine the proposal or clarify intent rather than choosing an
name arbitrarily. Do not supply a clarification target parameter.

Use the interactive question UI only on `ApprovalRequired`, then retry the same
`proposedTrait` with `approved: true` after Save. The tool rechecks every
existing trait and preserves the selected UUID on clarification. If the store or
selected action changes between approval and retry, obtain fresh approval rather
than reusing the flag. `Updated` returns the saved trait. Never claim approval
not given by the user or delete a trait merely needing clearer wording.

## Reconcile conflicting traits

`derive_trait` checks the proposal against every stored trait and automatically
selects confirmed conflicts for reconciliation. There is no separate resolution
tool and no trait-selection parameter. Inconclusive comparisons block
reconciliation rather than authorizing deletion.

Before writing, the shared approval flow shows the selected originals with their
names and bodies, the proposal, the removal plan, and the replacement policy.
Approval authorizes model-generated reconciliation, not silent deletion. On
`ApprovalRequired`, ask through the interactive UI and retry the same proposal
with `approved: true` only after Save. If relationships or originals change,
obtain fresh approval.

After approval, the tool evaluates each body and the proposal for decomposition,
then generates standalone replacements. The proposal takes precedence in direct
conflicts; unrelated requirements, scopes, and exceptions should be preserved.
It saves the replacements before deleting the selected originals and returns
`Resolved` with the saved traits and their new names and UUIDs.

Inspect those replacements. Do not call `derive_trait` again for the same
proposal: resolution has already saved its content. The initial comparison
covers all stored traits, but generated replacements are not automatically
revalidated against unaffected traits; review the replacements and check the
relevant code.

Writes and removals are not transactional. If resolution fails, inspect the
store before retrying; some changes may already be present.

## Check the implementation

### Required review procedure

1. Before editing, read the stored trait bodies and identify which apply to the
   planned work. Do not rely on filenames, remembered summaries, or examples
   alone; preserve each rule's scope and exceptions.
2. Track every TypeScript file you generate or modify, including files changed
   while fixing findings. Review the final on-disk contents, not an earlier
   version or only the initial set of files.
3. Independently inspect each changed section against every applicable trait. An
   empty tool result does not replace direct inspection against the trait text.
   Formatting, lint, and type checks do not establish trait compliance.
4. For recognizable patterns, search explicitly and inspect matches. For the
   curried-call rule, look for nested calls such as `fn(args)(value)`, including
   multiline forms and `yield* S.decodeUnknownEffect(schema)(input)`. Check the
   actual signature before deciding whether a match is a violation. Also inspect
   parameter destructuring, manually constructed tagged-union members, wrapped
   schema modifiers, and misplaced imports when their traits apply. Searches
   support review; a lack of matches is not proof that every trait is satisfied.
5. Call `check_traits` on all changed TypeScript files after the latest edits.
   Before a commit or PR, omit `traitIds` so every stored trait is checked;
   focused checks supplement rather than replace that final review.
6. Inspect findings, fix confirmed violations, and repeat direct inspection,
   tool checks, and relevant project verification after fixes. If any reviewed
   file changes again, its earlier result is stale and it must be rechecked.
7. Keep automated results and manual triage distinct. Routine summaries should
   report confirmed issues, meaningful unresolved uncertainty, operational
   failures, and blockers requiring a user decision—not every raw finding.
   Preserve the reviewed scope and raw results for audit without repeating
   rejected false positives as caveats. Never claim an automated clean pass when
   raw findings remain, or turn an empty result into unconditional compliance.

### Targeted trait exceptions

For a justified file-scoped exception, add a line comment in the leading header,
before any code:

```ts
// traits-ignore-file <trait-uuid-or-name>: Explain why this trait cannot apply here.
```

Each directive requires a nonempty reason and exactly one UUID or name. UUIDs
match one trait and survive renames. Names are case-sensitive and match every
trait with that exact name; update name-based directives after renaming a trait.
Use a UUID when only one of several same-name traits should be ignored. Filename
stems and partial names are not selectors. Repeat the comment for additional
exceptions. Only the referenced traits are skipped; other traits remain checked.
Exceptions apply to all file chunks and focused checks. Comments after code are
ignored.

Read the referenced trait and verify the reason before adding or retaining an
exception. Do not add directives merely to silence findings: fix applicable
violations, and ask the user before introducing an exception that overrides
their preference. Respect existing justified exceptions during manual review.

### Tool behavior and remediation

- After generating or editing TypeScript files, select those files and call
  `check_traits({ include: files })`.
- After creating or resolving traits, explicitly review relevant TypeScript
  files. Saving traits does not automatically check code.
- Omit `traitIds` for the full trait set. Supply UUIDs for focused follow-ups,
  especially the replacements returned by resolution. An empty array selects no
  traits; unknown IDs fail the call.
- `include` accepts file paths or glob patterns, absolute or relative to the MCP
  working directory. Overlapping matches are deduplicated; unmatched patterns
  select no files. Use `traits/**/*.ts` rather than a bare directory. Glob
  traversal always excludes dependencies, Git metadata, and nested worktrees.
  `TraitsConfig.excludes` adds filenames or native filesystem glob patterns,
  relative to the directory containing `traits.ts` or absolute. Use
  `directory/**` to exclude a subtree; bare directories are not expanded
  automatically. Escape glob characters in literal filenames using native glob
  syntax. This repository configures `repos/**` and `**/dist/**` in `traits.ts`.
  No custom path classification or glob expansion semantics are imposed.
- Assess only project-owned source and relevant authored configuration or
  documentation. For whole-project audits, prefer an explicit project-file
  manifest. Never submit third-party/reference code, generated output or
  lockfiles, secrets, `.env` files, credentials, or binary assets. Reading a
  dependency's source to verify an API does not make it part of the audit scope.
- The tool checks current full files in 200-line chunks, including unstaged
  content. It does not inspect the Git index or compute a diff.
- Each expression finding contains the trait and source excerpt with a file path
  and 1-based chunk starting line. That line is not an exact violation location.
  Its `assessment` includes classification and probabilities. `inconclusive` is
  not a confirmed violation. Inspect the full distribution; probabilities are
  not calibrated guarantees.
- Inspect the code and trait before fixing a finding. Respect scope and
  exceptions; missing context is not proof of a violation.
- Own the remediation loop whenever you discover an applicable violation,
  whether from this tool or your own inspection. Automatically make minimal,
  behavior-preserving fixes without waiting for another user request; a findings
  summary alone is not completion. This tool diagnoses; the agent makes edits.
- Recheck every corrected file and run relevant formatting, type, and behavior
  checks. Repeat for remaining confirmed violations. Do not weaken or rewrite
  traits merely to silence findings, and do not change correct code for false
  positives or inapplicable rules.
- Do not repeat rejected, irrelevant false positives or already-justified
  exceptions in routine user summaries. Explain them when the user requests an
  audit, needs a decision, or a new material reliability problem is discovered.
  If a fix requires changed behavior, broader authorization, or resolving
  ambiguity, ask a focused question and report the blocker rather than silently
  expanding scope. Do not claim compliance while confirmed violations remain;
  model errors make the review incomplete, not passing.

### Reporting triage

Before presenting a finding, establish that the rule applies and identify the
actual offending code. A helper parameter is not a model-visible tool parameter;
local destructuring is not parameter destructuring. Check the exact scope and
exceptions rather than treating a matching topic as a violation.

Fix confirmed applicable violations within scope and verify the fix. Surface
remaining actionable issues, material uncertainty, failed/incomplete checks, and
decisions the user must make. Routine completion messages can state which build,
lint, and type checks passed without adding distracting checker false positives.
Do not imply that a rejected finding requires work or that the automated trait
review returned no findings when it did.

Keep unmodified raw assessments available in tool output or configured
telemetry; do not change tool filtering or introduce probability cutoffs to hide
inconvenient results. Low confidence alone is not grounds for dismissal, and
earlier false positives do not justify rejecting a new finding without
inspecting it. A newly discovered systemic reliability issue remains worth
reporting. When asked for audit details, distinguish confirmed, unresolved, and
rejected findings and give the rejection rationale. Quiet reporting is not
skipped remediation or lost signal.

- Before committing or opening a PR, review the changed TypeScript files against
  all traits. An empty result means no failures for the selection; empty
  selections, unmatched patterns, or an empty trait store perform no
  assessments.

## Operation

The CLI launcher installs project dependencies in its current directory before
importing the MCP server. Run it from the checkout/workspace root. It selects
the package manager from `package.json#packageManager` or an unambiguous
lockfile; the selected executable must be on PATH. Installation preserves
lockfiles but can execute lifecycle scripts, so only launch in trusted
checkouts. Allow enough MCP startup time for a cold install and avoid
simultaneous installations in the same worktree. During development, use
`node traits/bin.ts` with a Node version supporting native TypeScript execution;
pass server flags after the filename.

Configuration and providers currently initialize at server startup. Startup
failures go to stderr and require fixing setup and reconnecting; whether the
agent can see these diagnostics depends on its MCP client. Expected tool
failures use MCP error results; unexpected defects receive a generic internal
error rather than implementation details.

Git-ignored files are excluded by default, with ignore rules refreshed on every
check. Untracked files do not need to be added to Git to be evaluated. Tracked
files stay eligible even if ignore rules match them. Set
`excludeGitignored: false` in `traits.ts` to disable this filter; explicit
excludes still apply. Git failures fail checks.

For setup, follow the canonical guide at
https://github.com/crosshatch/traits/blob/main/SETUP.md. Respect the consumer's
package manager and workspace dependency conventions, ask about providers and
models before writing configuration, and preserve existing settings. The guide
covers dependencies, credentials, skill installation, MCP connection, and
troubleshooting. The agent creates traits.ts using the selected providers; there
is no init command. Discover the connected server's `derive_trait` and
`check_traits` tools through the client's tool catalog.

The CLI's configuration layer loads and validates the default-exported object
from repository-root `traits.ts`. Import the `TraitsConfig` type from `traits`
and use `export default { ... } satisfies TraitsConfig`. Specify
`layerDecisionModel` and `layerLanguageModel`; `excludes` is optional. The CLI
supplies platform/HTTP services. Storage remains local and has no source
configuration. The current configuration uses TypeSafe for decisions and OpenAI
for generation, requiring `TYPESAFE_API_KEY` and `OPENAI_API_KEY`. Configuration
precedence is process environment, worktree-root `.env`, then main-checkout
`.env`. Reconnect the MCP server after changing credentials. A failed model
request is an incomplete review, not a pass.

The project MCP command leaves telemetry disabled. For optional OTLP telemetry,
launch with `npx traits --otlp-endpoint http://127.0.0.1:4318`. The flag is an
OTLP/HTTP collector base URL; traces and logs go to `/v1/traces` and `/v1/logs`
beneath it using JSON, with service name `traits` and the package version.
Metrics are not exported. Omit the flag to disable exports. URLs must use
HTTP(S). Base paths and query parameters are preserved; fragments are ignored.
Avoid credentials in command-line URLs. Stderr logging remains enabled; stdout
stays reserved for MCP.

The CLI does not start a collector or persist telemetry locally. Configure the
collector's storage, rotation, retention, and access controls separately. Use a
loopback collector for local debugging and read its configured output files; do
not assume an output directory exists. Treat telemetry as potentially sensitive:
spans and logs can include file paths and error text. No full trait bodies,
source bodies, or authorization headers are intentionally attached by this
integration, but that is not a blanket redaction guarantee. Do not publish
collector output without inspection and redaction.
