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

Enrichment module references must be distinct within a trait, so each module
unambiguously identifies its configured enrichment in outcomes and recoveries.

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

Enrichment context uses this representation. Serialized input reports carry only
paths, sides, and ranges, not source contents.

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
setup failures produce diagnostics. Whether assessment requires that enrichment
is a separate policy, not a decision encoded by the setup error. During
execution, `Enrichment` affects only its current invocation. Enrichments cannot
halt unrelated traits. Whole-evaluation halts belong to the evaluator rather
than extensions.

Parallel failures are collected rather than reduced to one winning error.
Cancellation stops remaining work at the requested scope, but does not erase
successful results or failures already observed. A later trait-wide failure does
not invalidate assessments already completed. Cancelled work gets no invented
failure or recovery instruction.

Recognized enrichment signals are stored once in the trait report's
`recoveries`, with their module, instruction, and stage. Execution signals also
identify their scope reason and reference the originating input by index within
the containing trait report. Recognition is stage-specific: an error from the
wrong stage is an ordinary diagnostic, not a recovery control signal.

Other failures and defects are stored once in `diagnostics`, not duplicated in
`recoveries`. Unknown enrichment execution failures omit that invocation's
context and produce a `Failed` outcome; they do not infer `Input` or `Trait`
cancellation. Siblings may continue and assessment follows the existing recovery
policy. Interruption is cancellation, never a diagnostic or recovery signal.

Each diagnostic contains a configured module and a safe, nonblank message, with
optional actionable instructions only when remediation is known. The runner must
handle arbitrary thrown values, including cyclic objects and ordinary errors,
without relying on JSON serialization. It must exclude raw error objects, source
text, and excerpts from diagnostics and use a generic failure message when
useful details cannot be safely extracted. A diagnostic explains failure; it
need not invent a remedy.

Each diagnostic's `origin` is tagged `SegmenterSetup`, `SegmenterExecution`,
`EnrichmentSetup`, or `EnrichmentExecution`. Shared module, message, and
optional instruction fields live on the diagnostic itself. Setup origins have no
input reference. Segmenter execution diagnostics reference the caller's supplied
change by index in caller order, before filtering or scheduling; callers retain
that association outside the source-free report. The runner validates change
indices against the supplied changes. Enrichment execution diagnostics reference
the containing trait report's inputs, preserving their before/after provenance.
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
└── traits: TraitReport[]
    ├── static Trait
    ├── recoveries: Recovery[] (execution input index)
    ├── diagnostics: Diagnostic[] (setup, change index, or input index)
    └── inputs: InputReport[]
        ├── path: string
        ├── side: before | after
        ├── range: InputRange
        ├── EnrichmentReport[]
        └── Assessment?
```

Input reports contain paths, sides, and ranges, without source text or excerpts.
Assembly maps `Before`/`After` segments to report `side: before`/`side: after`,
using the selected source's path and the primary range. Historical context
ranges are not echoed into the report. Full sources remain available internally
during execution. Each trait definition appears once in its trait report.
Generated enrichment text remains in the report, but should not routinely echo
the source.

Ranges describe the text supplied for evaluation, not necessarily the file's
current contents. Clients must already have that text or read the file to
inspect code. The side specifies whether the path and offsets address before or
after content, including deleted files and renamed paths. It does not identify a
specific revision; callers must retain any further association with supplied
versions outside the report. Execution recoveries retain this provenance through
their input-report reference.

Input entries are allocated in deterministic source/range order, including work
that fails or is cancelled, so execution recoveries always have a target. Setup
failures do not fabricate input entries. The trait report schema validates
recovery and enrichment-diagnostic input indices. Range ordering and nonnegative
offsets are validated by the report schemas, but bounds against source length
must be validated during execution before reporting. Input indices must remain
stable when assembling partial results; completion order does not determine
their values.

Report assembly must preserve the originating input and module for each
execution failure when assigning these indices. The schema's bounds check alone
does not prove that a recovery references the input and module that actually
failed.

Trait-first grouping remains unchanged; alternative grouping is a separate
design decision.

An enrichment report is `Completed`, with required generated `text`, `Failed`,
or `Cancelled`. Failure details are stored in the trait's recovery or diagnostic
entries, not duplicated in enrichment or input reports. Setup failures are
recorded once, without fabricating per-input execution failures.

A missing assessment alone does not indicate failure, since guidance-only traits
also omit assessments. The overall report may carry evaluator-owned halt
guidance; enrichment recoveries remain attached to their traits.

Partial results are preserved through skips and halts, so the final report
contains completed work alongside any recovery instructions.
