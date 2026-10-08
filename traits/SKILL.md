---
name: traits
description: >-
  Use when the user corrects an approach, expresses a reusable coding
  preference, or asks to remember a convention; when reconciling conflicting
  traits; and after generating or editing TypeScript files or before committing
  them.
---

# Traits

Traits are concise, durable coding rules. This server stores each body in
`.agents/traits/<three_words-uuid>.md`, relative to its working directory. The
full filename stem is the trait ID, for example
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
4. Call `derive_trait({ proposedTrait })`. This checks for conflicts and writes
   immediately when no failures are returned. It does not independently decide
   whether the conversation contains a generalizable insight.
5. A void success means the trait was saved. Do not repeat the call because its
   response is empty. Read the store if you need its newly generated ID.
6. A list of `Fail` entries means nothing was saved. Inspect the existing bodies
   and IDs. A failure may be an inconclusive comparison rather than a confirmed
   contradiction. Clarify or revise the proposal, or intentionally reconcile the
   relevant existing traits.

Overlap and duplicate wording alone are not blocked by the conflict check. Avoid
creating duplicates at the drafting stage.

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
  exceptions; missing context is not proof of a violation. Fix relevant issues
  and rerun affected files, reporting unresolved findings or model errors.
- Before committing or opening a PR, review the changed TypeScript files against
  all traits. An empty result means no failures for the selection; empty
  selections or an empty trait store perform no assessments.

## Operation

Launch from the project root with `node traits/src/main.ts`. The configured
OpenCode MCP server is `traits`; discover its `derive_trait`,
`resolve_conflicting_traits`, and `check_trait_expression` tools through the
client's tool catalog.

The CLI uses TypeSafe for decisions and OpenAI for generation. It needs
`TYPESAFE_API_KEY` and `OPENAI_API_KEY`. Configuration precedence is process
environment, worktree-root `.env`, then main-checkout `.env`. Reconnect the MCP
server after changing credentials. A failed model request is an incomplete
review, not a pass.
