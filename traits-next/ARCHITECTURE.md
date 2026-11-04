# Trait evaluation lifecycle

## Runtime API

`check({ traits, changes })` evaluates caller-ordered static traits and changes
and returns a `Report`. It requires `SegmenterRegistry`, `EnrichmentRegistry`,
and a `DecisionModel` when assertions are assessed. Guidance-only traits do not
call the decision model. Success of the Effect means report assembly finished,
not that its assessments satisfy a caller's acceptance policy; use
`Report.isPass` for that interpretation.

Subject identification is also available independently as
`TraitSubject.match(subjects, input)`, where subjects is a caller-keyed record.
It submits one named `yes/no/uncertain` classification per subject over shared
source context in one `DecisionModel.decideSettled` request. Its response
retains keyed outcomes, request usage, and provider metadata. Each outcome is a
validated answer (including probabilities) or an `Unanswered` result; missing,
refused, or invalid answers do not discard valid siblings. Request-wide failures
remain in the Effect error channel. An empty record makes no provider request
and reports zero token usage. Single-subject requests use the same API, for
example `TraitSubject.match({ subject }, input)`. Matching neither evaluates an
assertion nor applies a gating policy. Callers choose appropriately sized
subject groups for the selected provider; this API does not batch unrelated
inputs or impose an unmeasured numeric batch limit.

`TraitAssertion.evaluate(assertions, input)` similarly batches caller-keyed
`TraitAssertionInput` values over shared source context with `decideSettled`.
Each request carries its assertion, static context (subject, purpose, body), and
its own successful enrichments. The model must not mix context across entries.
The four existing `pass`, `fail`, `na`, and `uncertain` classifications remain
unchanged. Responses preserve keyed outcomes, usage, and metadata; empty batches
make no provider request. `Trait.ts` defines the static trait schema, not the
evaluation operation.

`check` delegates each ready trait/input assessment to this collection API,
converting an unanswered outcome to an assessment-execution failure. It does not
yet coalesce work across traits; their existing recovery and cancellation
boundaries are unchanged. It does not automatically invoke subject matching,
skip work based on a subject probability, or add matching results to the report.
Callers may compose these independent APIs with an explicit policy.

An enrichment setup failure is reported once and disables that enrichment for
the check. Assessment still proceeds with remaining context unless an
input-scoped or trait-scoped execution recovery signal prevents it. There is no
required-enrichment policy flag in this API.

Build `SegmenterRegistry.layer` and `EnrichmentRegistry.layer` once in the
host's scoped runtime and reuse them across checks. They can be composed with
`Layer.mergeAll`. Their host services provide the extension capabilities
declared by `ExtensionServices`, excluding the chats and scopes the registry
creates itself. Keep the same model/account bindings for the lifetime of those
registries. Each registry owns its own typed cache; the internal
`ExtensionRegistry.make` shares cache lifecycle, setup-scope ownership, service
capture, and fresh execution contexts without a kind discriminator. It accepts
setup-result, setup-error, and execution-error schemas; `ExtensionModule.load`
owns importing, module/result validation, and rejection of undeclared setup
errors. The shared execution transformer preserves declared execution errors and
turns unexpected failures into defects. Each typed registry still owns its
execution contract. Module-shape and setup-result validation failures remain
typed `SchemaError`s alongside the declared setup error. Registry service types
are inferred from their `make` effects, with host services provided internally.
Extension references must already be canonical, importable module specifiers;
trait-file loading, module canonicalization, CLI profile-to-runtime wiring, and
explicit in-place registry reset remain separate work.

Checker phases return their data rather than preallocating mutable observations.
`Check/Preparation.ts` collects unique extension references and returns
read-only maps of setup/segmentation `Result`s: success values or safe
diagnostics, not both an `Exit` and a derived diagnostic. Registry layers still
own setup caching. `Check/Execution.ts` returns ordered trait/input results.
Enrichment outcomes carry completed context, a failure diagnostic and recovery
scope, or cancellation. Trait/input `Deferred`s coordinate recovery; they do not
store report results. `Check/CheckState.ts` defines immutable work/results and
projects completed phases into the report, sharing successful-context selection
with assessment and omitting source text.

Cancellation uses normal Effect fiber interruption: pending work is interrupted
and execution cleanup completes, without returning a partial report. Callers do
not provide an `AbortSignal`. Cancellation does not invent failure diagnostics.

```text
Static traits + provided inputs
  → initialize extensions
  → segment each change
  → enrich each trait/source location
  → assess assertions
  → return reports and recovery instructions
```

## Provide traits and inputs

A `Trait` is a static definition: its name, purpose, optional subject, assertion
and supporting body, optional segmenter module, and optional enrichment modules.
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

Each trait may reference a segmenter and enrichments. These extensions are
initialized before use, separating reusable setup from the work performed for
each input or location.

Initialization is shared across the entire program lifecycle, not repeated per
trait or evaluation. A program-level registry identifies an extension by its
kind (segmenter or enrichment) and resolved module identity. Module references
are canonicalized when constructing static trait definitions, so aliases resolve
to one registry entry and one report module reference. Concurrent callers await
the same initialization outcome. Setup resources live until program shutdown or
an explicit reset; each distinct execution owns its resources. Shared setup
state must support concurrent executions across traits and evaluations.

A failed initialization remains failed until explicit reset or program restart;
starting another evaluation does not retry it. Reset must coordinate dependent
executions before replacing setup resources. Registry, resolution, and reset
implementation remain separate from these lifecycle contracts. The implemented
registry retains setup fibers and their outcomes until its host scope closes;
one interrupted waiter does not interrupt initialization shared by other checks.
Creating a new registry after shutting down the owning runtime starts a new
setup lifecycle. An in-place reset API is not implemented.

Enrichment module references must be distinct within a trait, so each module
unambiguously identifies its configured enrichment in results and failures.

## Select ranges within a change

When a trait has no segmenter, the evaluator uses the entire after-source, or
the entire before-source for a whole-file deletion, as one input. No parser or
segmentation extension runs. Internally this is represented by a full-file
`After` or `Before` range, including `{ start: 0, end: 0 }` for an empty file.
Default whole-file selection does not compute historical correspondence, so
`After.before` is omitted.

Within one evaluation, the runner segments each caller-supplied change once per
resolved segmenter module, sharing the validated result or failure across all
traits using that module. Concurrent consumers share the same invocation; an
observed execution failure is recorded once for its module and change. This
execution-sharing contract is separate from program-lifetime initialization and
does not cache results across evaluations. Each shared invocation owns its own
execution resources. The evaluator implements this with invocation-local
segmenter results, validating each complete result before allocating downstream
inputs.

Segmentation is intentionally trait-independent in this version. A segmenter
receives no trait subject, assertion, or per-trait options; traits using the
same resolved module receive the same segments for a change. Different selection
behavior requires different segmenter modules, which may reuse implementation
internally. Trait-specific enrichment and assessment remain separate downstream
work.

Trait independence enables sharing segmentation results; it is not required to
share initialization. If per-trait execution options are introduced later,
execution identity must include every option that affects segmentation rather
than sharing by module and change alone. Setup identity would need to change
only if those options also affect initialization. Per-trait options and their
identity semantics remain deferred.

Segmenter initialization returns an execution function that takes a `Change`
directly and produces an array of `Segment` values:

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
and must fit within its source text. Neither boundary may split a UTF-16
surrogate pair. This does not require grapheme-cluster boundaries.

`Input` is a top-level `Before | After` tagged union containing the segment
fields and shared `change`. Each case reuses `ChangeWithBefore` or
`ChangeWithAfter` from `Change.ts`, so the selected source is present in both
the runtime schema and the static type. Segment fields reuse the corresponding
case in `Segment.ts`. `fromSegment` validates construction; `toSegment` returns
the source-free shape used in reports. Its schema checks primary and historical
range bounds and surrogate-pair boundaries against their respective source
texts. Before and after offsets are independent: mapped correspondence must be
established through diff analysis, not numeric overlap. Bounds validation alone
does not establish correspondence. Simple segmenters may omit mappings;
change-aware implementations may supply them.

Mappings are supplied by the segmenter. The runner does not promise to compute
missing mappings.

Enrichment context uses this representation. Serialized input reports preserve
the complete segment and reference the caller's change, without source contents.

An empty result successfully selects no targets for the change. It produces no
input reports, enrichment, assessments, or diagnostics; requested trait reports
remain represented even when their inputs are empty. This outcome may pass
`Report.isPass` when no other failure or halt occurred. Failures and defects
must not be converted into empty successful results.

Segmentation must succeed and cannot request skips or evaluation halts. Before
scheduling any enrichments for a change, the runner validates the entire custom
result: every segment combined with that change must validate as an `Input`. A
malformed segment, unavailable selected side, or out-of-bounds primary or
historical range rejects the entire result for that change; valid fragments are
not scheduled separately. This validation checks bounds, not diff
correspondence.

Initialization or execution failures and defects prevent dependent enrichment
and assessment. Initialization failure blocks all changes using that segmenter;
execution failure or invalid output blocks the current change for every trait
sharing that invocation. Other segmenters and unaffected changes may continue.
No replacement segments or synthetic input reports are created. All requested
trait reports remain represented, even when their inputs are empty. The shared
setup or execution diagnostic records the failure once; invalid output produces
a diagnostic describing the validation failure. These diagnostics make
`Report.isPass` false even if unaffected assessments pass.

No fallback preserves the configured segmenter's selection semantics. Generic
text chunks may not represent its intended targets and can produce misleading
assessments, duplicated context, and unnecessary model calls. We accept reduced
coverage after segmentation failure, including potentially deleted material,
rather than silently substitute another selection strategy. For example, a
syntax error blocks dependent traits for a change only if their segmenter cannot
handle it and fails. Diagnostics expose that failure, recovery instructions make
known remediation actionable, and unaffected work may continue. An empty result
therefore means successful selection of no targets, never concealed failure.

Segmenter error channels are stage-specific. `SegmenterSetupError` provides
required recovery instructions for initialization, and `SegmenterError` provides
them for execution. The runner recognizes each only at its matching stage and
reports `Diagnostic.Instruction` with the corresponding segmenter origin.
Unexpected defects and contract-violating failures follow ordinary failure
normalization: `Error` unless the runner independently knows actionable
remediation. Instructions never turn a segmenter failure into a skip or halt
request.

## Enrich each trait and source location

For each location selected for evaluation, enrichment receives:

- `trait`: the unchanged static definition.
- `input`: an `Input` containing the shared `change` and the selected segment's
  fields. Its top-level tag determines the primary side; `After.before` provides
  optional historical context. Both complete source versions remain available
  when present.

For an `After` segment, enrichments access mapped historical ranges through
`input.before` and resolve their text against `input.change.before.text`. These
ranges may represent multiple historical regions and need not correspond to
separately emitted `Before` segments. Mapping availability is optional:
enrichments must not interpret an omitted mapping as evidence that no previous
content exists. Before-only segments remain available for independently
assessing deleted material.

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

Each input report has a required execution `status`, independent of assertion
acceptance:

- `Completed`: required work finished. Assertion inputs have an assessment;
  guidance-only inputs do not. A high `fail` probability is still a completed
  evaluation, not an execution failure.
- `Failed`: this input could not finish, including an assessment failure or an
  enrichment recovery signal preventing completion. It has no assessment.
- `Cancelled`: this input was stopped before completion by interruption or
  another input's trait-wide recovery. It has no assessment. Already completed
  inputs retain their completed status and assessment.

An enrichment-only recovery can still allow a `Completed` input with an
assessment; its diagnostic independently prevents the report from passing.
Status does not duplicate failure explanations: diagnostics explain failures,
and report interruption or recovery provenance explains cancellation.

The report retains probabilities rather than the provider-selected label.
Consumers interpret them using explicit thresholds or decision policies; the
highest probability alone does not necessarily justify a definitive result.

## Handle skips and halts

Extensions map expected underlying failures into their stage-specific API
errors: `SegmenterSetupError` or `EnrichmentSetupError` for initialization, and
`SegmenterError` or `EnrichmentError` for execution. These are the declared
error channels; extensions do not serialize underlying errors. Unexpected
failures may be explicitly promoted to defects, and thrown exceptions remain
defects. Narrowing the types alone does not convert failures into defects.
Required recovery guidance must be actionable rather than invented merely to
satisfy the type.

The runner still normalizes unexpected defects and contract violations from
untrusted extensions at the boundary. `EnrichmentError` execution signals
require nonblank recovery instructions. Their reason determines which remaining
work stops:

| Reason       | Effect                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `Enrichment` | Omit this enrichment's context; siblings may continue.                                               |
| `Input`      | Prevent assessment of this trait for the input and cancel its remaining enrichments.                 |
| `Trait`      | Cancel remaining work for this trait across inputs because a trait-wide prerequisite is unavailable. |

An initialization failure disables the enrichment. A recognized
`EnrichmentSetupError` carries recovery guidance, not a scope reason; other
setup defects or contract violations produce ordinary diagnostics. Whether
assessment requires that enrichment is a separate policy, not a decision encoded
by the setup error. After an `Enrichment`-scope skip, assessment proceeds with
the remaining available context unless another outcome prevents assessment, such
as `Input` or `Trait` cancellation. During execution, `Enrichment` affects only
its current invocation. Enrichments cannot halt unrelated traits.
Whole-evaluation halts belong to the evaluator rather than extensions.

Parallel failures are collected rather than reduced to one winning error.
Cancellation stops remaining work at the requested scope, but does not erase
successful results or failures already observed. A later trait-wide failure does
not invalidate assessments already completed. Cancelled work gets no invented
failure or recovery instruction.

All observed extension and assessment failures and defects are stored in
`Report.diagnostics`, each recorded once per returned report with its origin and
explanation. Extension origins also contain the configured module. Diagnostics
help the client explain problems and remediation; recovery-control decisions
remain internal to the runner. Recognized enrichment execution signals retain
their `Enrichment`, `Input`, or `Trait` reason on `EnrichmentError`, but
diagnostics serialize only the explanation tag, its text, and the module-bearing
origin. Recognition remains stage-specific: an error from the wrong stage is an
ordinary failure, not a recovery control signal.

Ordinary failures may also include actionable instructions; remediation text
never implies cancellation. Unexpected enrichment execution defects or contract
violations omit that invocation's context; they do not infer `Input` or `Trait`
cancellation. Siblings may continue and assessment proceeds with the remaining
available context unless another outcome prevents assessment. Interruption is
cancellation and never creates a diagnostic.

Each diagnostic is a tagged union with a shared `origin` field and exactly one
explanation: `Error { error }` for normalized failure details, or
`Instruction { instruction }` for actionable remediation including relevant
failure context. Both alternatives require nonblank text; the tag selects the
explanation, with normal unknown-property handling. The runner chooses
`Instruction` when remediation is known and `Error` otherwise. The runner must
handle arbitrary thrown values, including cyclic objects and ordinary errors,
without relying on JSON serialization. It must exclude raw error objects, source
text, and excerpts from diagnostics and use a generic failure message when
useful details cannot be safely extracted. Unexpected failure explanations must
be bounded, readable text rather than serialized arbitrary payloads. A
diagnostic explains what happened; it need not invent a remedy.

Each diagnostic's `origin` is tagged `SegmenterSetup`, `SegmenterExecution`,
`EnrichmentSetup`, `EnrichmentExecution`, or `AssessmentExecution`. The
explanation lives on the diagnostic itself. The configured `module` lives inside
each extension origin; assessment origins have no extension module. Setup
origins have no trait or input reference. Segmenter execution failures reference
`Report.changes` by index in original caller order, before filtering or
scheduling. The report schema validates change indices against this path table.
The configured module and change identify the shared segmentation invocation,
without choosing an originating trait. Enrichment execution failures reference
the originating trait by index in `Report.traits` and its inputs, preserving
their before/after provenance. Assessment execution origins identify the trait
and failed assertion input without inventing an extension module. Model failures
produce safe, bounded diagnostics rather than erasing completed results or being
confused with a negative assertion assessment. Setup failures do not fabricate
inputs, and segmenter failures need no synthetic assessment target.

Reports use deterministic ordering based on trait, source/location, and
configured module order, not the timing of concurrent completions. Scheduling
and cancellation are runner responsibilities; the schemas represent their
results.

## Assemble the report

Reports group results by trait, then by evaluated source location:

```text
Report
├── changes: ChangePaths[] ({ before?: string, after?: string }, at least one side)
├── interrupted: boolean
├── instruction?: string
├── diagnostics: Diagnostic[] (Error | Instruction, with origin)
└── traits: TraitReport[]
    ├── static Trait
    └── inputs: InputReport[]
        ├── change: number
        ├── segment: Segment
        ├── status: Completed | Failed | Cancelled
        ├── EnrichmentReport[]
        └── Assessment?
```

Input reports reference changes by index in the original caller-supplied order,
before filtering or scheduling, and preserve the complete `Segment`, without
source text or excerpts. This includes historical correspondence on `After`:
omission means unknown, while an empty array means no counterpart. Required
`Report.changes` records before and/or after paths for every supplied change in
caller order, including changes with no inputs or failed segmentation. At least
one path is required per change; separate paths preserve renames. Both input and
segmentation diagnostic indices resolve through this table without the original
request. The table remains complete in partial and interrupted reports. Full
sources remain available internally during execution. Each trait definition
appears once in its trait report. Generated enrichment text remains in the
report, but should not routinely echo the source.

Ranges describe the text supplied for evaluation, not necessarily the file's
current contents. Paths are self-contained in the report; retrieving exact
source versions still requires external provenance. Clients can inspect retained
supplied snapshots or retrieve matching versions from a known Git baseline;
arbitrary supplied text need not exist in Git. The segment tag identifies the
primary source side, and historical ranges address the same change's before
source. Reports do not identify Git revisions or embed snapshots. Enrichment
execution failures retain this provenance through their input-report reference.

Input entries are allocated in deterministic source/range order, including work
that fails or is cancelled, so enrichment execution failures always reference an
input. Setup failures do not fabricate input entries. The root report schema
validates enrichment execution trait/input indices, requires enrichment failure
modules to be configured enrichments, and requires segmenter failures to name
the segmenter configured by at least one reported trait. Each input's enrichment
modules must be configured and unique. Assessment diagnostics must identify a
failed assertion input. Completed assertion inputs require an assessment;
guidance-only, Failed, and Cancelled inputs cannot carry one. The runner must
prevent assessment of an input stopped by `Input` or `Trait` recovery while
preserving completed assessments on other inputs. The schemas enforce status and
assessment consistency, but cannot establish whether the runner assigned the
correct status in response to cancellation or recovery. Range ordering and
nonnegative offsets are validated by the report schemas, along with change-index
bounds and path presence for primary and historical source sides. Range bounds
and surrogate boundaries against source text must be validated during execution
before reporting. Input indices must remain stable when assembling partial
results; completion order does not determine their values.

Clients scan `Report.diagnostics` for problems and remediation. Setup failures
name an extension configured by at least one reported trait; affected traits can
be identified from their configuration. Segmenter execution origins identify the
shared change; enrichment execution origins identify the particular trait and
input involved. The registry owns persistent setup outcomes; report assembly
includes each relevant setup failure once. Later evaluations may include the
same persistent setup failure again without implying another initialization
attempt. Trait and input indices are report-local, not program-lifetime
identities. Event deduplication remains an assembly obligation; structural
validation cannot establish that two entries describe the same event.

Report assembly must preserve the originating module and change for segmentation
failures, or trait and input for enrichment failures, when assigning these
indices. The schema's bounds check alone does not prove that a failure
references the input and module that actually failed.

Trait-first grouping remains unchanged; alternative grouping is a separate
design decision.

An enrichment report contains only a `module` and successfully generated `text`,
including a valid empty string. Failed, cancelled, and unstarted enrichments do
not produce enrichment entries. Absence does not distinguish these execution
states. Failure details are stored in the report's shared diagnostics. Setup
failures are recorded once, without fabricating per-input execution failures.

A missing assessment alone does not indicate failure, since completed
guidance-only traits also omit assessments; the input status records execution
completion. The overall report may carry evaluator-owned halt guidance alongside
the shared diagnostic list.

Partial results are preserved through skips and halts, so the final report
contains completed work alongside any recovery instructions.

## Reevaluate after remediation

`Report.isPass` requires `interrupted: false`, the absence of diagnostics and
evaluator halt instructions, Completed status on every input, and acceptance of
every required assessment by a caller-supplied decision policy. Guidance-only
traits require no assessment. No probability threshold or not-applicable
acceptance rule is implicit in the helper.

This relies on a complete runner-produced report: all requested trait
evaluations must be represented, and every failure, skip, cancellation, or
unfinished check must be accounted for by a diagnostic, evaluator instruction,
or evaluation interruption. A shared cancellation or halt explanation may cover
multiple inputs without duplicate diagnostics. Every report has a required
`interrupted` boolean. An interrupted evaluation returns `interrupted: true`,
preserving completed results and already-observed diagnostics without inventing
assessments or extension failures for cancelled work. No interruption message or
instruction is required; `Report.instruction` remains available for actual
evaluator halt guidance. Recovery-scope cancellation already explained by an
enrichment diagnostic does not itself set `interrupted`. If no report is
returned, success cannot be inferred. The helper cannot detect omitted work from
the original request; zero scheduled inputs may legitimately pass when no work
was applicable and no failure, halt, or interruption occurred.

After the client follows recovery instructions, reevaluation starts from the
affected sources or changes, not their previous segments. Reload the relevant
inputs, rerun segmentation, and rerun all applicable trait checks, including
previously successful checks. Remediation can change both source contents and
segmentation boundaries.

Report-local input indices and ranges describe one evaluation; they are not
durable retry identifiers. Incremental checking, dependency tracking, cache
invalidation, and persistent lock formats are deferred until the core execution
model is established. The client report supplies results and remediation, not an
execution ledger or retry schedule. A passing assessment does not by itself
establish successful execution; observed extension failures remain relevant even
when other work produces passing assessments.
