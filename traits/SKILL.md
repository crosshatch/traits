---
name: traits
description: >-
  Use when the user corrects an approach, expresses a reusable coding
  preference, or asks to remember a convention; when reconciling conflicting
  traits; and after generating or editing TypeScript files or before committing
  them.
---

# Traits

Traits are concise, durable coding rules. The filesystem implementation stores
each body in `.agents/traits/<three_words-uuid>.md`, relative to its working
directory. The full filename stem is the trait ID, for example
`rose_karate_frog-2535ceab-5702-4ab4-932a-f87362adf8c6`. Read these files to
discover existing rules and IDs; pass the full ID, not just the words, to tools.

## Capture a reusable insight

1. Notice user corrections and recurring preferences without waiting for an
   explicit mention of traits. Also handle explicit requests to remember a rule.
2. Distinguish a durable convention from a one-off task, transient fact, or
   vague reaction. Read existing traits and reuse covered rules rather than
   duplicating them. Clarify ambiguous scope before drafting.
3. Draft the complete rule as `proposedTrait`. Preserve essential requirements,
   scopes, and exceptions. Keep independently applicable rules separate; omit
   headings, repetition, and unnecessary explanation or examples.
4. Call `derive_trait({ proposedTrait })`. This checks existing traits and
   writes only when the proposal is distinct from all of them. It does not
   independently decide whether the conversation contains a generalizable
   insight.
5. A void success means the trait was saved. Do not repeat the call because its
   response is empty. Read the store if you need its newly generated ID.
6. A list of `Fail` entries means nothing was saved. Inspect the existing bodies
   and IDs. A failure may be an inconclusive comparison rather than a confirmed
   contradiction. Clarify or revise the proposal, or intentionally reconcile the
   relevant existing traits.

`Covered` entries mean existing traits already express the proposal; reuse them
without creating a duplicate. `Clarification` entries mean an existing rule can
be made clearer while preserving its intent, requirements, scope, and
exceptions. Neither outcome writes files.

For clarification, show the current trait body and the complete proposed
replacement and ask the user to approve that exact body and trait ID. After
approval, call
`derive_trait({ proposedTrait, clarificationTraitId, approved: true })`. It
rechecks all traits and updates only the selected trait when it qualifies as a
clarification and no blocking relationships remain. `Updated` returns the saved
trait with its original ID. Never claim approval not given by the user or use
conflict resolution to delete a trait merely needing clearer wording.

## Reconcile conflicting traits

Call `resolve_conflicting_traits({ conflictingTraitIds, proposedTrait })` when
the selected existing rules should be replaced to incorporate the proposal. Use
the trait IDs from the store or the preceding conflict results.

The tool evaluates each body and the proposal for decomposition, then generates
standalone replacements. The proposal takes precedence in direct conflicts;
unrelated requirements, scopes, and exceptions should be preserved. It saves the
replacements before deleting the selected originals and returns the new traits
with their IDs and bodies.

Inspect those replacements. Do not call `derive_trait` again for the same
proposal: resolution has already saved its content. Traits outside the selected
IDs are not compared during resolution.

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
5. Call `check_trait_expression` on all changed TypeScript files after the
   latest edits. Before a commit or PR, omit `traitIds` so every stored trait is
   checked; focused checks supplement rather than replace that final review.
6. Inspect findings, fix confirmed violations, and repeat direct inspection,
   tool checks, and relevant project verification after fixes. If any reviewed
   file changes again, its earlier result is stale and it must be rechecked.
7. Report tool results and manual verification separately. State the reviewed
   scope, retained false positives or exceptions, and incomplete checks. Never
   turn an empty tool result into an unconditional claim of compliance.

### Tool behavior and remediation

- After generating or editing TypeScript files, select those files and call
  `check_trait_expression({ files })`.
- After creating or resolving traits, explicitly review relevant TypeScript
  files. Saving traits does not automatically check code.
- Omit `traitIds` for the full trait set. Supply IDs for focused follow-ups,
  especially the replacements returned by resolution. An empty array selects no
  traits; unknown IDs fail the call.
- Paths must identify files, either absolute or relative to the MCP working
  directory. The tool does not expand directories or globs. Source metadata uses
  the server's configured `agentId`, currently `local`.
- The tool checks current full files in 200-line chunks, including unstaged
  content. It does not inspect the Git index or compute a diff.
- Each `Fail` contains the trait and source excerpt with a file path and 1-based
  chunk starting line. That line is not an exact violation location. Violations
  and inconclusive assessments have the same result shape.
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
- Explain retained false positives or justified exceptions. If a fix requires
  changed behavior, broader authorization, or resolving ambiguity, ask a focused
  question and report the blocker rather than silently expanding scope. Do not
  claim compliance while confirmed violations remain; model errors make the
  review incomplete, not passing.
- Before committing or opening a PR, review the changed TypeScript files against
  all traits. An empty result means no failures for the selection; empty
  selections or an empty trait store perform no assessments.

## Operation

Launch from the project root with `node traits/src/main.ts`. The configured
OpenCode MCP server is `traits`; discover its `derive_trait`,
`resolve_conflicting_traits`, and `check_trait_expression` tools through the
client's tool catalog.

The CLI loads the default export of repository-root `traits.ts`, validated by
`TraitsConfig`. Specify `layerDecisionModel` and `layerLanguageModel`; the CLI
provides the HTTP client. Storage remains local and has no source configuration.
The current configuration uses TypeSafe for decisions and OpenAI for generation,
requiring `TYPESAFE_API_KEY` and `OPENAI_API_KEY`. Configuration precedence is
process environment, worktree-root `.env`, then main-checkout `.env`. Reconnect
the MCP server after changing credentials. A failed model request is an
incomplete review, not a pass.
