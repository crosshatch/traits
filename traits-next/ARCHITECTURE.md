# Trait evaluation lifecycle

```text
Static traits + provided inputs
  → initialize extensions
  → segment each source
  → enrich each trait/source location
  → assess assertions
  → return reports and recovery instructions
```

## Provide traits and inputs

A `Trait` is a static definition: its name, subject, purpose, optional assertion
and supporting body, required segmenter module, and optional enrichment modules.
Enrichment never rewrites the trait or its body.

Lifecycle changes and evaluation sources are separate representations:

- `Snapshot` describes a creation, update, or deletion. Updates retain both
  content versions and the previous path, including renames.
- `InputSource` identifies one selected version by its path and complete
  `Content`: decoded text or binary bytes.

The caller provides the input to evaluate. Segmentation operates on that input's
complete source contents; diff selection and before/after pairing are not the
segmenter's responsibility.

## Initialize extensions

Each trait references a segmenter and may reference enrichments. These
extensions are initialized before use, separating reusable setup from the work
performed for each input or location.

## Segment a selected source

The segmenter receives an `InputSource` and produces a nonempty array of
`InputSegment` values:

- `Full` selects the complete source.
- `Range` selects decoded text using zero-based UTF-16 offsets, with an
  inclusive start and exclusive end.

A range must have nonnegative integer offsets, must not end before its start,
and must fit within its source text. Binary sources use `Full`, not text ranges.

Segmentation must succeed and cannot request skips or evaluation halts. If
custom segmentation fails, evaluation falls back to text-based chunking; binary
sources fall back to `Full`. Cancelling evaluation does not trigger fallback
work.

## Enrich each trait and source location

For each location selected for evaluation, enrichment receives:

- `trait`: the unchanged static definition.
- `input`: the complete selected source version.
- `location`: the `Full` or `Range` segment being evaluated.

The enrichment returns a string of context for that evaluation. An empty string
is a valid completed result. The source remains available in full even when the
evaluated location is only a range.

Traits run in parallel, and enrichments for a trait run in parallel. Enrichment
context supplements the static trait definition; it does not replace or modify
it. Assessment proceeds after the relevant enrichments finish, unless recovery
has prevented that assessment.

## Assess the assertion

When a trait has an assertion, assessment uses the static trait definition, the
selected source location, and generated enrichment context. The decision model
provides the probabilities retained in an `Assessment` for each outcome:

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

Every enrichment failure requires recovery instructions. Its reason determines
which remaining work stops:

| Reason       | Effect                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `Enrichment` | Omit this enrichment's context; siblings may continue.                                               |
| `Input`      | Prevent assessment of this trait for the input and cancel its remaining enrichments.                 |
| `Trait`      | Cancel remaining work for this trait across inputs because a trait-wide prerequisite is unavailable. |

An initialization failure disables the enrichment and carries recovery guidance,
not a scope reason. Whether assessment requires that enrichment is a separate
policy, not a decision encoded by the setup error. During execution,
`Enrichment` affects only its current invocation. Enrichments cannot halt
unrelated traits. Whole-evaluation halts belong to the evaluator rather than
extensions.

Parallel failures are collected rather than reduced to one winning error.
Cancellation stops remaining work at the requested scope, but does not erase
successful results or failures already observed. A later trait-wide failure does
not invalidate assessments already completed. Cancelled work gets no invented
failure or recovery instruction.

Each failure is stored once in its trait report's `recoveries`, with its module,
instruction, and stage. Execution failures also identify their scope reason,
source and location. Setup failures have no source location. Reports use
deterministic ordering based on trait, source/location, and configured module
order, not the timing of concurrent completions. Scheduling and cancellation are
runner responsibilities; the schemas represent their results.

## Assemble the report

Reports group results by trait, then by evaluated source location:

```text
Report
└── TraitReport[]
    ├── static Trait
    ├── Recovery[]
    └── InputReport[]
        ├── InputSource + InputSegment location
        ├── EnrichmentReport[]
        └── Assessment?
```

Each input report includes the source path and complete selected-version
contents, making its location interpretable without relying on array positions.
Its schema rejects text ranges outside the source or ranges against binary
content.

An enrichment report is `Completed`, with required generated `text`, `Failed`,
or `Cancelled`. Failure details are stored in the trait's recovery entries, not
duplicated in enrichment or input reports. Setup failures are recorded once,
without fabricating per-input execution failures.

A missing assessment alone does not indicate failure, since guidance-only traits
also omit assessments. The overall report may carry evaluator-owned halt
guidance; enrichment recoveries remain attached to their traits.

Partial results are preserved through skips and halts, so the final report
contains completed work alongside any recovery instructions.
