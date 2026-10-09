import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Layer, Logger, String } from "effect"
import { McpProtocol, McpServer } from "effect/ai"
import { Command } from "effect/cli"
import { FetchHttpClient } from "effect/http"

import * as TraitsConfigProvider from "./_util/TraitsConfigProvider.ts"
import { toolkit } from "./toolkit/toolkit.ts"
import { TraitsContext } from "./TraitsContext.ts"
import { layerFileSystem } from "./TraitStore.ts"

Command.make("traits").pipe(
  Command.withDescription("Run the traits MCP server over stdio"),
  Command.withHandler(() =>
    McpServer.layerStdio({
      name: "traits",
      version: "0.0.0",
      protocols: [McpProtocol.v2025_11_25],
      instructions: String.stripMargin(`
      | Traits are durable, reusable coding preferences stored as .agents/traits/<three_words-uuid>.md in the working directory.
      | The full filename stem is the trait ID; use it in tool calls, for example rose_karate_frog-<uuid>.
      | Before completing a response to a user correction, coding preference, or approved alternative idiom, check whether it expresses a reusable rule.
      | Treat multi-turn exchanges as a whole: asking about a better idiom and then approving it can establish a preference without saying "always" or "trait".
      | Err on the side of proposing a concise trait unless you have read an existing trait that clearly covers the exact rule and its scope.
      | If coverage is uncertain, propose the rule rather than silently assuming a broad trait covers it. If clearer wording is needed, propose a clarification.
      | Call the mutation tool with the drafted proposal first, leaving approved unset. Do not ask separately beforehand: native clients get an approval form.
      | Both mutation tools use native MCP forms when usable, or return ApprovalRequired with the complete proposal for that same interactive question flow.
      | Only on ApprovalRequired, show the full message using the interactive question tool: Save, Revise, Skip, plus its automatic free-text option. Use plain text only if that UI is unavailable.
      | Retry an identical approved proposal with approved: true; do not assert approval for changed wording or targets. Native forms still apply on supported clients.
      | RevisionRequired contains feedback to incorporate before requesting approval again; Declined means stop without writing.
      | Revise without actionable feedback requires an immediate interactive question asking what to change; never guess or treat it as Save.
      | Keep a revision pending across related audits or follow-up tasks. Complete that work, then return to the proposal unless explicitly cancelled.
      | Show the complete revised proposal and obtain fresh approval before saving; a findings summary does not resolve a pending revision.
      | Approval to edit code alone is not approval to persist a trait. Make the requested edit, but also propose the reusable rule before your final response.
      | Also act on explicit requests to remember a convention. Skip one-off requirements, transient facts, and preferences already covered.
      | Read existing trait files before drafting. Keep each trait concise and independently applicable, preserving scope and exceptions.
      | Call derive_trait with the drafted body as proposedTrait. It saves only distinct rules; Covered means reuse an existing trait.
      | A single clarification candidate is selected automatically and shown for approval; supply a complete replacement preserving the existing rule.
      | Multiple candidates return Clarification entries without writing: refine the proposal or clarify intent. Do not supply a target ID.
      | After fallback approval, retry with the same proposedTrait and approved: true; Updated preserves the selected existing ID.
      | Returned Fail, Covered, or Clarification lists mean nothing was saved; inspect the existing traits before proceeding.
      | Fail can also mean an inconclusive comparison. Clarify ambiguity rather than treating every failure as a proven contradiction.
      | To intentionally replace conflicting traits, call resolve_conflicting_traits with their IDs and the proposed body.
      | Resolution gives the proposal precedence in direct conflicts, writes generated replacements, then removes the selected originals.
      | Review the returned replacement bodies and IDs. Resolution already saves the proposal's content; do not derive it again.
      | After generating or changing TypeScript files, call check_trait_expression on those files.
      | After saving or resolving a trait, check the relevant TypeScript files explicitly; creation does not run that review for you.
      | Omit traitIds for all traits; use specific IDs for focused follow-ups. Before committing or opening a PR, review the changed TypeScript files.
      | Checks read current full files in 200-line chunks, not Git diffs. A finding's startLine locates a chunk, not an exact violation.
      | Take responsibility for trait compliance whenever a violation is discovered, through tool findings or your own inspection.
      | Inspect each finding against its trait, scope, exceptions, and surrounding source; confirmed violations must be fixed without waiting for another user request.
      | Make minimal behavior-preserving edits to the implementation, not to the trait merely to silence a finding. Do not stop at a findings summary.
      | Rerun check_trait_expression on every corrected file, then run relevant formatting, type, and behavior checks; repeat for remaining confirmed violations.
      | A Fail may be inconclusive or inapplicable. Do not blindly change correct code; explain any retained false positives or justified exceptions.
      | If a fix requires a behavior change, broader authorization, or an ambiguous interpretation, ask a focused question and report the blocker.
      | Do not claim compliance while confirmed violations remain. Report model errors as incomplete reviews, not passes.
      | An empty result only means no failures for the selected files and traits; empty selections or an empty store perform no assessments.
      | On mutation errors, inspect the store before retrying: writes and removals are not transactional, and retries may duplicate saved traits.
      `)
    }).pipe(
      Layer.provide(
        toolkit.pipe(
          Layer.provide(layerFileSystem(".agents/traits")),
          Layer.provide(TraitsContext.layer),
          Layer.provide(FetchHttpClient.layer),
          Layer.provideMerge(McpServer.McpServer.layer)
        )
      ),
      Layer.launch,
      Effect.provideService(Logger.LogToStderr, true)
    )
  ),
  Command.run({ version: "0.0.0" }),
  Effect.provide(TraitsConfigProvider.layer.pipe(Layer.provideMerge(NodeServices.layer))),
  NodeRuntime.runMain
)
