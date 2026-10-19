# AI-first trait format plan

## Goal

Represent traits as small, domain-neutral policies that AI can discover, assess,
and use through MCP. Support software development, law, creative writing,
marketing, payment decisions, and other domains without domain-specific schemas
or arbitrary structured metadata.

This document proposes the format and implementation plan. It does not implement
the change.

## Proposed shape

Store each trait as YAML frontmatter followed by optional Markdown context.
Frontmatter has a fixed vocabulary of natural-language fields:

| Field           | Required | Meaning                                                                                       |
| --------------- | -------- | --------------------------------------------------------------------------------------------- |
| `name`          | Yes      | Stable, unique identity. Retain the existing descriptive kebab-case naming rules.             |
| `subject`       | Yes      | The kind of artifact, action, transaction, relationship, or situation to look for and assess. |
| `requirement`   | Yes      | What should be true about the subject. The authoritative criterion for assessment.            |
| `applicability` | No       | Circumstances under which the requirement applies, including relevant exceptions.             |
| `purpose`       | No       | What the trait aims to achieve or protect, and why that matters.                              |
| `guidance`      | No       | Advice on responding to a violation or approaching satisfaction of the requirement.           |

The Markdown body provides optional supporting context: examples, code diffs,
references, domain details, explanations, or procedural detail. Domain
information that does not belong in a core field belongs here, not in additional
frontmatter keys or typed profiles.

Use multiline YAML literal blocks for multiline values. Omit unnecessary
optional fields rather than filling them with redundant or invented content.

### Example

```markdown
---
name: stay-within-delegated-spending-authority
subject: A payment an agent is considering authorizing.
requirement: >
  The payment must fall within the agent's delegated spending authority.
applicability: >
  Before committing funds on behalf of another party.
purpose: >
  Prevent unauthorized spending while allowing autonomous purchases.
guidance: >
  Pay when authority is established. Otherwise negotiate terms that fall within
  it, decline, or escalate to an authorized decision-maker.
---

Supporting context, examples, references, and explanations.
```

## Semantic boundaries

- **Subject identifies; requirement evaluates.** Avoid repeating the requirement
  inside the subject description.
- **Applicability scopes the requirement.** Omission means no additional
  restriction beyond the subject, not applicability to every possible subject.
- **Requirement is authoritative.** Purpose, guidance, and context must not
  introduce hidden obligations. Promote essential assessment criteria into the
  requirement or applicability.
- **Purpose explains intent.** It can inform interpretation but is not a
  separate compliance test.
- **Guidance advises; it does not authorize.** Describing payment, negotiation,
  editing, or script execution does not grant permission to perform those
  actions. Existing caller and tool permissions remain authoritative.
- **Context is available during assessment.** It is not restricted to
  presentation after a match: examples and references can help interpret the
  trait.
- **Invocation supplies the execution context.** Coding-agent sessions,
  precommit hooks, PR verification, payment requests, and other environments are
  circumstances provided by the MCP caller, not a separate `where` field. If a
  stage genuinely limits a trait, express that in applicability.
- **Keep traits atomic.** Each trait expresses one independently applicable
  requirement, with its scope and supporting explanation.

## Assessment and retrieval

Keep these operations conceptually distinct:

1. Retrieve candidate traits relevant to the caller's circumstances and
   subjects.
2. Identify subjects and determine whether each trait applies.
3. Assess applicable subjects against the requirement, using supporting context.
4. Consult guidance when proposing a response within the caller's authority.

A semantic retrieval match is not proof of applicability or violation. Preserve
the distinction between not applicable, satisfied, unsatisfied, and
undetermined. Missing evidence is not automatically a violation or permission to
proceed.

Use the named fields to support focused decision-model questions and searchable
representations. Treat vector indexes as derived, rebuildable views of stored
traits, not as their identity or source of truth. Retrieval can shortlist
candidates but must not be presented as an exhaustive compliance guarantee.

## Implementation plan

1. **Update the domain schema.** Introduce the fixed fields above, replacing the
   current body-centric requirement, structured applicability, dedicated diff,
   and extension metadata. Represent applicability as natural-language text and
   the Markdown body as optional context. Reject unsupported frontmatter keys
   rather than silently discarding them.
2. **Update parsing and serialization.** Preserve field content and optional
   Markdown context, including multiline text, indentation, and trailing
   newlines. Keep identity and filename conventions unchanged.
3. **Update MCP contracts and prompts.** Carry complete traits through
   derivation, approval, clarification, reconciliation, storage, and checks.
   Approvals must cover the complete proposed trait, including context. Evaluate
   requirements separately from applicability and distinguish guidance from
   authorization.
4. **Migrate stored traits.** Rewrite every existing trait into the new shape,
   preserving its identity, intent, scope, exceptions, and useful context.
   Convert existing applicability metadata into prose. Move diff examples into
   Markdown context. Review existing extension metadata individually so
   meaningful information is preserved as context rather than dropped.
5. **Update documentation and skill instructions.** Replace guidance for the old
   format, including dedicated diff parameters and structured applicability.
6. **Verify the change.** Run focused behavior tests, repository checks, builds,
   and the applicable trait review procedure.

Do not silently reinterpret old-format files as new-format traits. Before
implementation, choose an explicit compatibility or migration boundary and
ensure old-format parse failures provide actionable migration guidance.

## Verification priorities

- Required-field validation and rejection of unsupported fields.
- Minimal traits with no optional fields or context.
- Exact multiline field and Markdown context roundtrips, including indentation,
  separators, examples, and trailing newlines.
- Preservation of complete traits through storage and approval boundaries.
- Migration review against original intent, applicability, exceptions, and
  examples.
- Focused real-model checks where assessment semantics materially change; use
  deterministic tests for parser, storage, and protocol behavior.

## Non-goals

- Typed domain profiles or arbitrary structured metadata.
- A workflow engine embedded in each trait.
- Executable authority granted by retrieved trait content.
- Domain-specific lifecycle stages or artifact types baked into the core schema.
- A guarantee of exhaustive coverage from vector similarity alone.
