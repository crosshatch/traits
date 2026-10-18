# Why we use a System One model to review LLM code

The standard approach to producing project-aligned LLM-generated code involves
routing code to a second LLM and checking outputs against a ruleset defined by
engineers of a codebase. The setup is relatively easy, and results are often
acceptable considering the speed.

Traits, our open-source tool for converting a developer's corrections into
durable coding preferences and checking new AI-generated code against them,
splits the work differently. A language model drafts the rules that a decision
model then enforces.

[Main points of article, results, etc.]

This post covers the reasoning behind that split and how we implemented it.

## Drafting and judging as separate workloads

Traits consists of two subsystems. The first is an LLM. When a developer
corrects the agent, Traits proposes a trait: a short Markdown file encoding a
single preference, scoped by trigger condition and file type. Producing that
file means compressing an unstructured correction into a general rule, diffing
it against the existing trait set, and phrasing conflicts so a human can resolve
them. Generation workloads like this play to an LLM's strengths.

The second subsystem, a decision model, runs compliance checks: given a 200-line
chunk and a trait, label the chunk `compliant`, in `violation`, or
`inconclusive`. That reduces to multi-class classification.

Running it as text generation from an LLM introduces three failure modes:

1. **Unstructured output.** An LLM judge emits prose, which you then parse into
   a verdict. The verdict varies with prompt phrasing, sampling temperature, and
   whatever the model chose to emphasize on a given run. It may include caveats
   that contradict your rulesets.
2. **Self-reported confidence.** Asking an LLM for a confidence score yields
   another generated token sequence. LLMs have a proven tendency toward
   overconfidence, and there's no principled way to tell a confident violation.
3. **Correlated errors.** When one model family both writes and reviews the
   code, its blind spots typically show up on both sides. LLM-as-judge setups
   also exhibit documented self-preference bias toward outputs resembling their
   own.

## Anatomy of a trait

Traits converts each (chunk, trait) pair into a classification query over four
fixed labels:

```typescript
Decision.classify({
  instructions:
    "Assess state.source.text against the following stored trait...",
  criteria: {
    compliant: "The trait applies and the input abides by it.",
    violation: "The input violates the trait.",
    "not-applicable": "The trait does not apply to the input.",
    inconclusive:
      "Insufficient context or ambiguity prevents a reliable judgment."
  }
})
```

The decision model (TypeSafe's Jev by default) returns a probability per label
instead of a generated answer. Traits takes the argmax as the classification,
retains the full distribution, and forwards only `violation` and `inconclusive`
results to the agent. The agent inspects the evidence, patches confirmed issues,
and re-runs the check on the file.

**`inconclusive` gives the model a sanctioned abstention.** A 200-line chunk
exposes only a window into a larger file. Sometimes a trait applies, but
compliance depends on code outside the window. The instructions forbid the model
from inventing surrounding code or assuming unseen dependencies don't exist.
Rather than guess, the model can abstain, which signals the agent to widen its
read. LLMs avoid inconclusive outputs because they are trained to present users
with satisfying answers.

**`not-applicable` keeps the trait set scalable.** Most traits have no bearing
on most chunks; a rule about React state says nothing about a database
migration. An explicit out-of-scope label, in place of an implicit pass, lets
Traits evaluate every chunk against every trait without a flood of false
positives.

The instructions err conservative elsewhere too. Code, comments, and string
literals count as evidence, which mitigates prompt injection from the repository
under review. A mention of a forbidden pattern in a comment or test name does
not constitute a violation.

## Distributions drive agent behavior

Every verdict comes with a probability distribution. A violation at p=0.95 and
one at p=0.52 warrant different handling. Patch the former and pull more context
for the latter.

Most coding preferences resist deterministic specification. Whether a helper
merits inlining, or whether an import style suits a given API, boils down to
judgment. Linters already cover the deterministic rules. However, the judgment
calls account for the edge cases developers are left revising in review or
guiding models through with additional prompts. Calibration means a stated 80%
corresponds to roughly 80% empirical accuracy. Decision models optimize for that
property during training, whereas chat models generally don't.

## Cost

The architecture also keeps full coverage affordable. Traits checks
bidirectionally: new code against every existing trait, and, on saving a new
trait, existing code against it. With 100+ traits over a production codebase, it
is possible to approach standards and quality alignment that previously wasn't
possible.

A recent Jev bill covering two full days of development came to $4.78 for 117.7M
tokens across 47.4k requests. The same input volume on a frontier LLM at typical
input pricing would run into the hundreds of dollars, not including the output
tokens.

Several engineering choices bound the request count:

- **Chunking:** files are read in 200-line chunks, so each question sees a
  bounded excerpt plus file path and start line.
- **Batching:** each decision request packs up to 16 trait questions per chunk
  under a fixed request budget, and batches execute concurrently.
- **Incremental reviews:** each review targets new code or a new trait, so cost
  scales with the diff.
- **Explicit exceptions:** a `traits-ignore-file` comment with a stated reason
  suppresses a named trait for one file.

## Failure modes

Calibrated probabilities don't represent a correct answer. A 90% verdict fails
roughly one time in ten. Hence, the agent verifies findings before applying
them, and humans still review the code. However, output logic is easier to
follow, and each turn reduces correction volume.

Overbroad traits produce overbroad checks. The model enforces whatever wording
the trait contains. Traits support narrowing and reconciling that wording, which
will be necessary throughout development.

Model versions also move. Our default config uses `jev-latest`. If you want
reproducible results, for example in CI, pin a specific model version.

## Generalizing

The pattern extends past code review. When an agent pipeline needs a judgment,
determine whether the task reduces to generation or classification. For
classification, a purpose-built model reports its own uncertainty, costs a
fraction as much, and avoids grading LLM output with the same class of model
that produced it.

Traits is open source at
[github.com/crosshatch/traits](https://github.com/crosshatch/traits), with an
overview at [traits.sh](https://traits.sh). The decision logic described here
lives in `traits/TraitEvaluation.ts`.
