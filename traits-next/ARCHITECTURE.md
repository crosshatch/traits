# Trait evaluation lifecycle

```text
Static traits + provided inputs
  → initialize extensions
  → segment each change
  → enrich each trait/source location
  → assess assertions
  → return reports and recovery instructions
```

## Provide traits and inputs

A `Trait` is a static definition: its name, subject, purpose, optional assertion
and supporting body, required segmenter module, and optional enrichment modules.
Enrichment never rewrites the trait or its body.

Lifecycle changes and evaluation sources are separate representations:

- `Change` contains `before` and/or `after` sources, with at least one required
  in both the schema and inferred type. After-only means creation, before-only
  means deletion, and both means update. Each source has its own path,
  preserving renames without a separate path field.
- `InputSource` identifies one selected version by its path and complete decoded
  `text`. Only text inputs are supported; binary files must be excluded or
  explicitly rejected at the input boundary, not silently decoded as text.

The caller supplies a change. Segmenters can inspect both available versions and
select assessment targets from either side. This does not require full semantic
analysis of both versions or a historical compiler project.

## Initialize extensions

Each trait references a segmenter and may reference enrichments. These
extensions are initialized before use, separating reusable setup from the work
performed for each input or location.

Initialization is shared across the entire program lifecycle, not repeated per
trait or evaluation. A program-level registry identifies an extension by its
kind (segmenter or enrichment) and resolved module identity. Module references
are canonicalized when constructing static trait definitions, so aliases resolve
to one registry entry and one report module reference. Concurrent callers await
the same initialization outcome. Setup resources live until program shutdown or
an explicit reset; execution resources remain independent. Shared setup state
must support concurrent executions across traits and evaluations.

A failed initialization remains failed until explicit reset or program restart;
starting another evaluation does not retry it. Reset must coordinate dependent
executions before replacing setup resources. Registry, resolution, and reset
implementation remain separate from these lifecycle contracts.

Enrichment module references must be distinct within a trait, so each module
unambiguously identifies its configured enrichment in results and failures.

## Select ranges within a change

Segmenter initialization returns an execution function that takes a `Change`
directly and produces a nonempty array of `Segment` values:

- `Before`: a primary `range` in the before-source, including deleted material.
- `After`: a primary `range` in the after-source, plus optional `before` ranges
  providing mapped historical context.

An omitted `After.before` means correspondence has not been computed; an empty
array means it was computed and found no counterpart. Nonempty historical ranges
require a before-source. Each segment produces one assessment input; historical
context ranges are not additional independent assessment targets.

Each range selects decoded text using zero-based UTF-16 offsets, with an
inclusive start and exclusive end. The complete source is represented by
`{ start: 0, end: source.text.length }`, including `{ start: 0, end: 0 }` for
empty text.

A range must have nonnegative integer offsets, must not end before its start,
and must fit within its source text.

`Input` pairs the shared `change` with a `segment`. Its schema requires the
selected side to exist and checks primary and historical range bounds against
their respective source texts. Before and after offsets are independent: mapped
correspondence must be established through diff analysis, not numeric overlap.
Bounds validation alone does not establish correspondence. Simple segmenters may
omit mappings; change-aware implementations may supply them.

Mappings are supplied by the segmenter. The runner does not promise to compute
missing mappings, including when using fallback segmentation.

Enrichment context uses this representation. Serialized input reports preserve
the complete segment and reference the caller's change, without source contents.

Segmentation must succeed and cannot request skips or evaluation halts. Before
scheduling any enrichments for a change, the runner validates the entire custom
result: it must be nonempty, and every segment combined with that change must
validate as an `Input`. An empty result, malformed segment, unavailable selected
side, or out-of-bounds primary or historical range replaces the entire result
with fallback segmentation for that change; valid fragments are not scheduled
separately. This validation checks bounds, not diff correspondence.

Custom initialization or execution failures and defects also trigger text-based
fallback. Initialization failure uses fallback for all changes depending on that
initialization; execution failure affects the current change. Cancelling
evaluation does not trigger fallback work. Segmenter failures remain visible as
diagnostics even when fallback succeeds; invalid output also produces a
diagnostic describing the validation failure.

Both segmenter error channels accept arbitrary failures. `SegmenterSetupError`
provides required recovery instructions for initialization, and `SegmenterError`
provides them for execution. The runner recognizes each only at its matching
stage and reports `Diagnostic.Instruction` with the corresponding segmenter
origin. Both still trigger fallback. Wrong-stage errors and other failures
follow ordinary failure normalization: `Error` unless the runner independently
knows actionable remediation. Instructions never turn a segmenter failure into a
skip or halt request.

Fallback chunks every available source independently, covering its complete
text:

| Change           | Fallback targets                               |
| ---------------- | ---------------------------------------------- |
| Creation         | `After` chunks from the after-source.          |
| Deletion         | `Before` chunks from the before-source.        |
| Update or rename | `Before` and `After` chunks from both sources. |

Each empty source produces one range `{ start: 0, end: 0 }`. Fallback `After`
segments omit `before`, since correspondence was not computed. Both-side
fallback prioritizes coverage of deleted material over efficiency and can assess
unchanged material in both versions. It requires neither diff mapping nor
historical semantic analysis. Fallback inputs undergo the same validation before
enrichment.

## Enrich each trait and source location

For each location selected for evaluation, enrichment receives:

- `trait`: the unchanged static definition.
- `input`: an `Input` containing the shared `change` and one `segment`. The
  segment tag determines the primary side; `After.before` provides optional
  historical context. Both complete source versions remain available when
  present.

For an `After` segment, enrichments access mapped historical ranges through
`input.segment.before` and resolve their text against
`input.change.before.text`. These ranges may represent multiple historical
regions and need not correspond to separately emitted `Before` segments. Mapping
availability is optional: enrichments must not interpret an omitted mapping as
evidence that no previous content exists. Before-only segments remain available
for independently assessing deleted material.

The enrichment returns a string of context for that evaluation. An empty string
is a valid completed result. The source remains available in full even when the
evaluated location is only a range.

Traits run in parallel, and enrichments for a trait run in parallel. Enrichment
context supplements the static trait definition; it does not replace or modify
it. Assessment proceeds after the relevant enrichments finish, unless recovery
has prevented that assessment.

## Assess the assertion

When a trait has an assertion, assessment receives the static trait definition,
the complete validated `Input`, and completed enrichment context. The input
preserves both available source versions, the primary segment, and any
historical mappings, including the distinction between omitted and empty
mappings. This context remains available even when no enrichments are configured
or no enrichment context is produced, provided recovery has not prevented
assessment.

The segment's primary side and range identify the assessment target; the
surrounding change and historical mappings provide evidence, not additional
assessment targets. Enrichments supplement that evidence rather than being
responsible for preserving before/after context. The decision model provides the
probabilities retained directly as `Assessment` fields:

| Outcome     | Meaning                                       |
| ----------- | --------------------------------------------- |
| `pass`      | The assertion holds.                          |
| `fail`      | The assertion does not hold.                  |
| `na`        | The trait does not apply.                     |
| `uncertain` | Available evidence is insufficient to decide. |

Individual probabilities must be finite numbers between zero and one. Their
normalization is trusted to the decision model, not revalidated by the report
schema. These probabilities express relative certainty across outcomes;
`uncertain` explicitly indicates insufficient evidence to decide.

Guidance-only traits have no assertion and therefore no assertion assessment.

The report retains probabilities rather than the provider-selected label.
Consumers interpret them using explicit thresholds or decision policies; the
highest probability alone does not necessarily justify a definitive result.

## Handle skips and halts

Extension initialization and execution accept unknown failures. Extensions need
not serialize their errors; the runner normalizes failures at the boundary.
Recognized `EnrichmentError` execution signals require nonblank recovery
instructions. Their reason determines which remaining work stops:

| Reason       | Effect                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `Enrichment` | Omit this enrichment's context; siblings may continue.                                               |
| `Input`      | Prevent assessment of this trait for the input and cancel its remaining enrichments.                 |
| `Trait`      | Cancel remaining work for this trait across inputs because a trait-wide prerequisite is unavailable. |

An initialization failure disables the enrichment. A recognized
`EnrichmentSetupError` carries recovery guidance, not a scope reason; other
setup failures produce ordinary diagnostics. Whether assessment requires that
enrichment is a separate policy, not a decision encoded by the setup error.
After an `Enrichment`-scope skip, assessment proceeds with the remaining
available context unless another outcome prevents assessment, such as `Input` or
`Trait` cancellation. During execution, `Enrichment` affects only its current
invocation. Enrichments cannot halt unrelated traits. Whole-evaluation halts
belong to the evaluator rather than extensions.

Parallel failures are collected rather than reduced to one winning error.
Cancellation stops remaining work at the requested scope, but does not erase
successful results or failures already observed. A later trait-wide failure does
not invalidate assessments already completed. Cancelled work gets no invented
failure or recovery instruction.

All observed extension failures and defects are stored in `Report.diagnostics`,
each recorded once per returned report with its configured module, origin, and
explanation. Diagnostics help the client explain problems and remediation;
recovery-control decisions remain internal to the runner. Recognized enrichment
execution signals retain their `Enrichment`, `Input`, or `Trait` reason on
`EnrichmentError`, but diagnostics serialize only the explanation tag, its text,
module, and origin. Recognition remains stage-specific: an error from the wrong
stage is an ordinary failure, not a recovery control signal.

Ordinary failures may also include actionable instructions; remediation text
never implies cancellation. Unknown enrichment execution failures omit that
invocation's context; they do not infer `Input` or `Trait` cancellation.
Siblings may continue and assessment proceeds with the remaining available
context unless another outcome prevents assessment. Interruption is cancellation
and never creates a diagnostic.

Each diagnostic is a tagged union with shared `module` and `origin` fields and
exactly one explanation: `Error { error }` for normalized failure details, or
`Instruction { instruction }` for actionable remediation including relevant
failure context. Both alternatives require nonblank text; the tag selects the
explanation, with normal unknown-property handling. The runner chooses
`Instruction` when remediation is known and `Error` otherwise. The runner must
handle arbitrary thrown values, including cyclic objects and ordinary errors,
without relying on JSON serialization. It must exclude raw error objects, source
text, and excerpts from diagnostics and use a generic failure message when
useful details cannot be safely extracted. A diagnostic explains what happened;
it need not invent a remedy.

Each diagnostic's `origin` is tagged `SegmenterSetup`, `SegmenterExecution`,
`EnrichmentSetup`, or `EnrichmentExecution`. The explanation and shared `module`
field live on the diagnostic itself. Setup origins have no trait or input
reference. Execution origins reference the originating trait by index in
`Report.traits`. Segmenter execution failures reference the caller's supplied
change by index in caller order, before filtering or scheduling; callers retain
that association outside the source-free report. The runner validates change
indices against the supplied changes. Enrichment execution failures reference
the originating trait report's inputs, preserving their before/after provenance.
Setup failures do not fabricate inputs, and segmenter failures need no synthetic
assessment target.

Reports use deterministic ordering based on trait, source/location, and
configured module order, not the timing of concurrent completions. Scheduling
and cancellation are runner responsibilities; the schemas represent their
results.

## Assemble the report

Reports group results by trait, then by evaluated source location:

```text
Report
├── diagnostics: Diagnostic[] (Error | Instruction, with module and origin)
└── traits: TraitReport[]
    ├── static Trait
    └── inputs: InputReport[]
        ├── change: number
        ├── segment: Segment
        ├── EnrichmentReport[]
        └── Assessment?
```

Input reports reference changes by index in the original caller-supplied order,
before filtering or scheduling, and preserve the complete `Segment`, without
source text or excerpts. This includes historical correspondence on `After`:
omission means unknown, while an empty array means no counterpart. Paths,
including both paths for renames, are resolved through the original change. Full
sources remain available internally during execution. Each trait definition
appears once in its trait report. Generated enrichment text remains in the
report, but should not routinely echo the source.

Ranges describe the text supplied for evaluation, not necessarily the file's
current contents. Clients retain the original request to resolve paths and
source versions. They can inspect the supplied snapshots or retrieve matching
versions from a known Git baseline; arbitrary supplied text need not exist in
Git. The segment tag identifies the primary source side, and historical ranges
address the same change's before source. Reports do not identify Git revisions
or embed snapshots. Enrichment execution failures retain this provenance through
their input-report reference.

Input entries are allocated in deterministic source/range order, including work
that fails or is cancelled, so enrichment execution failures always reference an
input. Setup failures do not fabricate input entries. The root report schema
validates execution trait/input indices, requires enrichment failure modules to
be configured enrichments, and requires segmenter failures to name the
configured segmenter. Each input's enrichment modules must be configured and
unique. The schemas require a trait assertion for assessments. The runner must
prevent assessment of an input stopped by `Input` or `Trait` recovery while
preserving completed assessments on other inputs. This execution invariant is
not validated by the report schema because cancellation decisions are not
serialized. Range ordering and nonnegative offsets are validated by the report
schemas, but change-index bounds, source-side availability, and all ranges
against source length must be validated during execution before reporting. Input
indices must remain stable when assembling partial results; completion order
does not determine their values.

Clients scan `Report.diagnostics` for problems and remediation. Setup failures
name an extension configured by at least one reported trait; affected traits can
be identified from their configuration. Execution origins identify the
particular trait and input or change involved. The registry owns persistent
setup outcomes; report assembly includes each relevant setup failure once. Later
evaluations may include the same persistent setup failure again without implying
another initialization attempt. Trait and input indices are report-local, not
program-lifetime identities. Event deduplication remains an assembly obligation;
structural validation cannot establish that two entries describe the same event.

Report assembly must preserve the originating input and module for each
execution failure when assigning these indices. The schema's bounds check alone
does not prove that a failure references the input and module that actually
failed.

Trait-first grouping remains unchanged; alternative grouping is a separate
design decision.

An enrichment report contains only a `module` and successfully generated `text`,
including a valid empty string. Failed, cancelled, and unstarted enrichments do
not produce enrichment entries. Absence does not distinguish these execution
states. Failure details are stored in the report's shared diagnostics. Setup
failures are recorded once, without fabricating per-input execution failures.

A missing assessment alone does not indicate failure, since guidance-only traits
also omit assessments. The overall report may carry evaluator-owned halt
guidance alongside the shared diagnostic list.

Partial results are preserved through skips and halts, so the final report
contains completed work alongside any recovery instructions.

## Reevaluate after remediation

After the client follows recovery instructions, reevaluation starts from the
affected sources or changes, not their previous segments. Reload the relevant
inputs and determine which trait/change evaluations are invalidated. Rerun
segmentation and applicable checks for invalidated or retryable evaluations.
Retain clean passes only when their source versions and combined configuration
remain unchanged and the runner's invalidation policy permits reuse. Remediation
can change both source contents and segmentation boundaries.

Report-local input indices and ranges describe one evaluation; they are not
durable retry identifiers. Tracking affected inputs and determining what work to
redo belongs to the incremental tracking mechanism modeled by `TraitsLock`.
Setup failures may affect multiple inputs; that mechanism must retain the
affected source/change associations independently of report indices. The client
report supplies results and remediation, not an execution ledger or retry
schedule.

## Incremental evaluation records

`TraitsLock` is a first-pass, versioned schema for workspace-scoped tracking,
not an implemented cache. Each entry identifies one trait/change evaluation by
trait name, combined configuration digest, and before/after source paths and
content digests, and stores its check-level `result`. Absent sources differ from
empty text. Report-local indices, timestamps, and Git revisions are not durable
evaluation identities. Paths must be canonical within the workspace; copying
records between workspaces does not by itself establish equivalent inputs.

Fingerprints are lowercase SHA-256 digests. Their canonical serialization and
domain/version separation remain runtime contracts to implement. The
configuration digest covers the complete static trait definition, evaluator
version, model configuration, assertion thresholds and aggregation policy, and
resolved extension implementations. Module specifier strings alone do not
identify extension behavior.

The runner derives a check-level `CheckResult` shared by incremental tracking,
CI, and MCP consumers. Assessment probabilities describe the evaluated material;
the check result also accounts for whether required execution succeeded:

- `Pass`: all required work completed successfully and assessment policy
  accepted the result.
- `Fail`: an assessment failed or a required execution stage failed, including
  failures recovered through segmentation fallback or omitted enrichment
  context. An intentional enrichment skip also prevents a clean pass under the
  initial conservative policy.
- `Inconclusive`: execution succeeded but evidence did not establish an accepted
  assessment verdict.
- `Incomplete`: work was interrupted, cancelled, halted, or never finished.

Known failures take precedence over incomplete work; otherwise unfinished work
takes precedence over inconclusive assessments. Partial passing assessments
never establish a passing check. Fallback can continue gathering useful evidence
without turning an unsuccessful check into a pass. Detailed causes and
remediation remain in the report, rather than being duplicated in the lock. The
runner supplies the result directly; clients and tracking never infer it from
missing assessments or diagnostic prose. This is a contract for the deferred
runner, not implemented classification behavior.

CI treats only `Pass` as success. Reuse additionally requires identical
evaluation identity and approval under the runner's invalidation policy. Other
results remain tracked but do not qualify for reuse. Acceptance of
not-applicable and guidance-only evaluations requires explicit policy rather
than silently treating them as passes. Aggregation thresholds and mixed-segment
outcome rules belong to the fingerprinted decision policy; the schemas do not
derive check results from probabilities.

Dependency capture and storage are deferred; entries contain no dependency list
or coverage flag. Matching source and configuration fingerprints alone does not
establish safe reuse for checks affected by other files or external state. The
runner must rerun those checks unless its invalidation policy can establish that
their results remain valid. This schema does not implement that policy.

Record assembly replaces matching evaluation identities and preserves distinct
source versions where needed; retention, atomic writes, concurrency control,
crash recovery, and the `.traits-lock` storage location remain deferred. The
lockfile stores outcomes rather than full report evidence, so reuse does not
reconstruct an old report. Clients cannot infer per-input execution status from
missing assessments; durable status here is at trait/change granularity.
