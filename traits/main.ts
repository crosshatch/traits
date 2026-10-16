#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Layer, Logger, Option, Schema as S, String } from "effect"
import { McpProtocol, McpServer } from "effect/ai"
import { Command, Flag } from "effect/cli"
import { FetchHttpClient } from "effect/http"

import * as TraitsConfigProvider from "./_util/TraitsConfigProvider.ts"
import * as TraitsTelemetry from "./_util/TraitsTelemetry.ts"
import PackageJson from "./package.json" with { type: "json" }
import { toolkit } from "./toolkit/toolkit.ts"
import * as TraitsConfig from "./TraitsConfig.ts"
import * as TraitStore from "./TraitStore.ts"

Command.make("traits", {
  otlpEndpoint: Flag.String("otlp-endpoint").pipe(
    Flag.withSchema(
      S.URLFromString.check(
        S.makeFilter(
          (url) => url.protocol === "http:" || url.protocol === "https:" || "Use an HTTP(S) collector base URL."
        )
      )
    ),
    Flag.withDescription(
      "Export traces and logs as OTLP/HTTP JSON to this collector base URL (for example, http://127.0.0.1:4318). Disabled when omitted."
    ),
    Flag.optional
  )
}).pipe(
  Command.withDescription("Run the traits MCP server over stdio"),
  Command.withHandler((params) =>
    McpServer.layerStdio({
      name: "traits",
      version: PackageJson.version,
      protocols: [McpProtocol.v2025_11_25],
      instructions: String.stripMargin(`
      | Traits are durable, reusable coding preferences. The filesystem adapter stores each as .agents/traits/<name>-<uuid>.md, with a descriptive kebab-case name (no redundant trait- prefix) and stable UUID id in frontmatter.
      | The UUID is the canonical identity across storage backends. Use only UUIDs for focused traitIds selections. Ignore directives accept a UUID or an exact trait name, not a filename: a UUID targets one stable identity, while a name skips every trait with that name and must be updated after renaming. Supply a descriptive name when deriving a new trait; creation generates its UUID.
      | Before completing a response to a user correction, coding preference, or approved alternative idiom, check whether it expresses a reusable rule.
      | Treat multi-turn exchanges as a whole: asking about a better idiom and then approving it can establish a preference without saying "always" or "trait".
      | Err on the side of proposing a concise trait unless you have read an existing trait that clearly covers the exact rule and its scope.
      | If coverage is uncertain, propose the rule rather than silently assuming a broad trait covers it. If clearer wording is needed, propose a clarification.
      | Call the mutation tool with the drafted proposal first, leaving approved unset. Do not ask separately beforehand: native clients get an approval form.
      | derive_trait uses native MCP forms when usable, or returns ApprovalRequired with the complete proposal for that same interactive question flow.
      | Only on ApprovalRequired, show the full message using the interactive question tool: Save, Revise, Skip, plus its automatic free-text option. Use plain text only if that UI is unavailable.
      | Retry an identical approved proposal with approved: true; do not assert approval for changed wording or targets. Native forms still apply on supported clients.
      | RevisionRequired contains feedback to incorporate before requesting approval again; Declined means stop without writing.
      | Revise without actionable feedback requires an immediate interactive question asking what to change; never guess or treat it as Save.
      | Keep a revision pending across related audits or follow-up tasks. Complete that work, then return to the proposal unless explicitly cancelled.
      | Show the complete revised proposal and obtain fresh approval before saving; a findings summary does not resolve a pending revision.
      | Approval to edit code alone is not approval to persist a trait. Make the requested edit, but also propose the reusable rule before your final response.
      | Also act on explicit requests to remember a convention. Skip one-off requirements, transient facts, and preferences already covered.
      | Read existing trait files before drafting. Keep each trait concise and independently applicable, preserving scope and exceptions.
      | Keep frontmatter complementary: mime restricts file types, when defines positive semantic scope, and skip is only an independent exception within that scope. Omit redundant fields; never repeat when's negation as skip. Keep bodies standalone without repeated requirements or duplicate traits.
      | Write when values as conditions without a redundant leading When, for example when: editing React state.
      | Call derive_trait with the drafted body as proposedTrait. It saves only distinct rules; Covered means reuse an existing trait.
      | A single clarification candidate is selected automatically and shown for approval; supply a complete replacement preserving the existing rule.
      | Multiple candidates return Clarification entries without writing: refine the proposal or clarify intent. Do not supply a clarification target.
      | After fallback approval, retry with the same name, proposedTrait and approved: true; Updated preserves the selected existing UUID.
      | Every derive_trait response is one tagged TraitDerivation outcome. Created returns the saved trait with its name and UUID; Updated and Resolved return saved replacements.
      | Covered and Clarification return existing traits without writing. Inconclusive returns relationship findings and blocks all writes.
      | Inconclusive outcome findings use reason to distinguish conflict, coverage_gap, and inconclusive; clarify ambiguity before retrying.
      | Covered requires independent second-pass verification of the saved body and applicability metadata against the complete proposal. Similar intent is insufficient; coverage gaps enter approval-gated reconciliation and inconclusive verification blocks writes.
      | Confirmed conflicts and verified coverage gaps enter reconciliation inside derive_trait, selecting only the affected originals for an explicit replacement approval.
      | Approval must cover affected names, UUIDs, bodies, removals, the proposal, and generated reconciliation. Nothing is replaced silently.
      | After approval, reconciliation gives the proposal precedence in direct conflicts, saves generated replacements, then removes the conflicting originals.
      | Resolved returns saved replacement bodies, names, and UUIDs. Review them and check relevant code; do not derive the same proposal again.
      | After generating or changing TypeScript files, call check_traits on those files.
      | check_traits accepts include as file paths or glob strings, for example include: ["traits/**/*.ts"]. Overlapping matches are deduplicated.
      | Restrict assessments to project-owned source and relevant authored configuration/docs. Prefer an explicit project-file manifest for whole-project audits.
      | Never submit dependency/reference code, generated build output or lockfiles, Git metadata, secrets, .env files, credentials, or binary assets for assessment.
      | Unmatched patterns select nothing. Built-in exclusions cover dependencies, Git metadata, and nested worktrees; configure project-specific filenames or native glob patterns through TraitsConfig.excludes.
      | After saving or resolving a trait, check the relevant TypeScript files explicitly; creation does not run that review for you.
      | Omit traitIds for all traits; use specific UUIDs for focused follow-ups. Before committing or opening a PR, review the changed TypeScript files.
      | Checks read current full files in 200-line chunks, not Git diffs. A finding's startLine locates a chunk, not an exact violation.
      | Each finding includes assessment.classification and probabilities: inconclusive is unresolved context, not a confirmed violation. Probabilities are not calibrated guarantees.
      | Take responsibility for trait compliance whenever a violation is discovered, through tool findings or your own inspection.
      | Inspect each finding against its trait, scope, exceptions, and surrounding source; confirmed violations must be fixed without waiting for another user request.
      | Make minimal behavior-preserving edits to the implementation, not to the trait merely to silence a finding. Do not stop at a findings summary.
      | Rerun check_traits on every corrected file, then run relevant formatting, type, and behavior checks; repeat for remaining confirmed violations.
      | Triage raw findings against the exact rule, scope, exceptions, and source before reporting or editing. Do not blindly change correct code.
      | Routine user summaries should report confirmed issues, meaningful unresolved uncertainty, operational failures, and blockers requiring a decision.
      | Do not repeat rejected, irrelevant false positives as caveats or make them sound actionable. Keep raw results available in tool output and telemetry.
      | Discuss a rejected finding when the user requests audit details or it reveals a new material reliability problem; explain why it was rejected.
      | Never suppress actionable findings based only on confidence, assume a finding is false because similar ones were wrong, or claim an automated clean pass when raw findings remain.
      | If a fix requires a behavior change, broader authorization, or an ambiguous interpretation, ask a focused question and report the blocker.
      | Do not claim compliance while confirmed violations remain. Report model errors as incomplete reviews, not passes.
      | An empty result only means no failures for the selected files and traits; empty selections or an empty store perform no assessments.
      | On mutation errors, inspect the store before retrying: writes and removals are not transactional, and retries may duplicate saved traits.
      `)
    }).pipe(
      Layer.provide(
        toolkit.pipe(
          Layer.provide(TraitStore.layerFileSystem(".agents/traits")),
          Layer.provide(TraitsConfig.layer),
          Layer.provideMerge(McpServer.McpServer.layer)
        )
      ),
      Layer.launch,
      Effect.withSpan("traits.server"),
      Effect.provide(
        TraitsTelemetry.layer(Option.getOrUndefined(params.otlpEndpoint)).pipe(
          Layer.provideMerge(TraitsConfigProvider.layer),
          Layer.provideMerge(FetchHttpClient.layer)
        )
      )
    )
  ),
  Command.run({ version: PackageJson.version }),
  Effect.provide(NodeServices.layer),
  Effect.tapCause(Effect.logError),
  Effect.provideService(Logger.LogToStderr, true),
  NodeRuntime.runMain({ disableErrorReporting: true })
)
