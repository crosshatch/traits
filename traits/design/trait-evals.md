# Trait evaluation: design

Status: proposed. Nothing here is implemented yet.

A trait is only useful if the configured decision model applies it to code the
way its author intends. It should fail the code it targets, and it should not
flag nearby code that complies or that is out of scope. Today the repository
measures this with three scripts in `traits/eval/`, and newly derived traits are
proposed to the user without being measured at all. This design makes
measurement part of the library:

1. Every trait can have **cases**, saved with the trait and committed.
2. **`traits eval`** checks traits against their cases with a chosen model and
   reports how reliably each one behaves.
3. **`traits.derive`** builds cases for a proposal, evaluates it, and rewrites
   its wording until it behaves as intended. Only then does it show the
   proposal to the user, together with the workspace files it would flag.

## Why one mechanism covers the existing scripts

| Script | Cases | What it found |
| --- | --- | --- |
| `eval/run.ts` | Real files, labelled by hand | False positives on real code |
| `eval/misses.ts` | Generated violating and fixed pairs | Misses, and subjects too narrow to match |
| `eval/scenarios.ts` | Small multi-file projects, with and without an enrichment | Whether an enrichment is needed, and whether it helps |

All three check a set of files against one trait several times, without the
decision cache, and compare each result with a label. They differ only in where
the cases come from and in whether an enrichment is switched on or off. The
design keeps that core and makes the case source a detail.

## Cases

### Layout

```text
.agents/traits/_cases/<trait>/<case>/
  case.json
  files/...        the files the case needs, at workspace-relative paths
```

`case.json`:

```json
{
  "labels": { "posts/tags.ts": "fail", "posts/slug.ts": "pass" },
  "source": "feedback",
  "note": "normalizeTag has one use, in createPost.ts; toSlug has three."
}
```

- `labels` maps the case's target files to the expected result:
  - `fail`: in the subject, and violates the assertion.
  - `pass`: in the subject, and complies.
  - `unmatched`: out of the subject.

  Files without a label are context only, such as the consumers that the
  `references` enrichment reads.
- `source` records where the case came from:
  - `feedback`: code behind the user's feedback, supplied by the agent.
  - `workspace`: copied from the workspace.
  - `generated`: written by the language model.

  Labels on `feedback` cases are ground truth. Labels on `generated` cases are
  the generator's intent and can be wrong (see Derivation).
- `note` says why the label holds. Refinement and people reviewing the case
  both read it.
- A case may include a `tsconfig.json` or `package.json` when an enrichment
  needs one.

Cases are copies, never links into the workspace. A link would let an ordinary
code change silently turn a `fail` case into a pass.

### The workspace must not treat cases as code

Case files are deliberately non-compliant code inside the repository.

- `traits check` always skips `.agents/traits/_cases/`, without needing
  `exclude` in `traits.json`.
- Trait loading already ignores the directory, because it reads only the `.md`
  files directly in `.agents/traits/`.
- TypeScript, linters, and formatters must also skip the directory. Traits
  cannot do this for them. `traits eval` and `traits update` warn when a
  tsconfig in the workspace includes the directory, and `SETUP.md` gives the
  exclusion for common tools.

## Running an evaluation

### Engine

- **Core (`traits/Eval/`):**
  - The `Case`, `Label`, and `Evaluation` schemas.
  - Scoring of one trait over in-memory cases, given the check results of each
    run.
  - The evaluation report.
- **Local (`traits/local/LocalEval.ts`):**
  - Writes each case to a temporary directory, which becomes the
    `WorkspaceRoot` for that check.
  - Resolves extensions against the real workspace, so a case uses the
    workspace's installed enrichments. `eval/scenarios.ts` does the same today.
  - Runs `check` with the decision cache off, so that repeat runs are
    independent samples.

### Scoring

A run of a labelled file has one verdict under the policy (by default
`--fail 0.5 --pass 0.5`). Each verdict compares with its label as follows:

| Label | Correct | Wrong |
| --- | --- | --- |
| `fail` | Fail | Missed by the subject gate (Unmatched), or by the assertion (Pass or Inconclusive) |
| `pass` | Pass or Unmatched | False positive (Fail), or Inconclusive |
| `unmatched` | Unmatched or Pass | False positive (Fail), or Inconclusive |

A `pass` case that comes back Unmatched, or an `unmatched` case that comes back
Pass, still counts as correct. Neither flags code, but both are reported as
gate disagreements, because they show the subject is drawn in a different place
than intended.

For each trait the evaluation reports:

- correct runs, misses (by stage), false positives, and Inconclusive results;
- **stability:** the share of cases whose runs all agree;
- the probabilities for every wrong run, so the cause can be read.

**The bar.** A trait meets the bar when the majority verdict of every case
matches its label and no run of any case is a false positive. False positives
are what erode trust in a trait, so they are not averaged away. `--min-accuracy`
can relax the bar for misses.

### `traits eval`

```text
traits eval [--trait <name>]... [--environment <name>] [--runs 3]
            [--decision-model <provider/model>] [--fail <p> --pass <p>]
            [--generate]
```

- **Output:** writes the evaluation report to stdout and a summary to stderr,
  like `traits check`.
- **Exit codes:**

  | Code | Meaning |
  | --- | --- |
  | 0 | Every evaluated trait meets the bar |
  | 1 | Some trait falls short |
  | 2 | The evaluation could not run |

- **Traits without cases:** they are listed as unevaluated and do not affect
  the exit code.
- **Cache:** results are cached by trait digest, case digest, models, runs, and
  traits version. CI only re-evaluates traits or cases that changed.
- **`--decision-model`:** evaluates the same cases with another model, such as
  a cheaper one, without editing `traits.json`.
- **`--generate`:** writes generated cases for traits that have too few.
  Enough means at least one `fail`, one `pass`, and one near miss, which is
  compliant code that resembles a violation. It writes files, so it only runs
  when asked. It replaces `eval/misses.ts`, and adds near misses, which were the
  main source of false positives that generated pairs did not cover.

## Derivation

`traits.derive` keeps a single call and a single approval form per proposal.
What changes is the work before the form.

### Input

Each proposal gains `cases`: the concrete code behind the feedback. Each case
gives a workspace path, or inline text for code that was never saved (such as
a rejected draft), and its label. At least one `fail` case is required. The
corrected code, labelled `pass`, is strongly recommended. The tool description
tells agents to supply both.

### Steps

1. **Validate and compare** with existing traits, as today. Covered, NameTaken,
   and Unresolved still return before any evaluation is spent.
2. **Build cases:**
   - **Feedback cases** from the agent's input.
   - **Generated cases:** the language model writes about two violations and
     two compliant files, at least one of them a near miss, in scenarios
     different from the feedback cases.
   - **Existing cases** of a trait being clarified are included, so that a
     clarification cannot break behaviour that was already verified.
3. **Evaluate** the draft, with 2 runs per case.
4. **Refine,** up to 3 rounds while the draft falls short. The language model
   gets the trait, each wrong case with its label, note, and probabilities, and
   the rule that has guided the manual work: fix the cause in the subject,
   assertion, or body, and keep the name and intent. A revision is kept only if
   it scores strictly better and every feedback case is correct.

   A generated case whose label the refiner judges wrong may be dropped, with
   the reason recorded. Feedback cases are never dropped.
5. **Measure workspace impact:** check the refined trait against the workspace,
   using the decision cache, and collect the files it would flag and the count
   of Inconclusive files.
6. **Ask for approval.** The form message shows the trait, its evaluation
   ("correct on 7 of 7 cases over 2 runs"), and its impact ("would flag
   `a.ts`, `b.ts`, and 3 more files"). The form fields stay Save, Revise, and
   Skip.
7. **On Save,** write the trait file and its kept cases to
   `_cases/<trait>/`. Files from the workspace-impact step are not saved as
   cases, because no one confirmed their labels.

### Outcomes

- `Created` and `Updated` also carry the evaluation summary and the flagged
  files, so the agent can go on to fix them.
- New outcome **`Unreliable`:** the trait still falls short after refinement.
  It carries the remaining wrong cases. Nothing is shown to the user, and the
  agent revises the proposal with the user or narrows it.

### Circularity

The same family of models writes, labels, and judges generated cases. These
measures keep that from approving a trait that only agrees with itself:

- Feedback cases are ground truth, and a trait must get every one right.
- The decision model judges, and the language model generates and refines.
- The user approves against the trait's real impact on the workspace, not
  against generated cases.

### Latency

A derivation now makes a few dozen decision requests: about 7 cases × 2 runs ×
up to 4 rounds, plus the workspace check, which the cache makes cheap on
repeat. Expect tens of seconds instead of about 2.5 s. The server sends MCP
progress notifications at every step. Some clients time out tool calls after
about 60 s, so this must be measured against real clients.

## Migrating this repository

- `eval/scenarios.ts` projects become cases as they are. The
  with-and-without-enrichment comparison becomes
  `traits eval --compare-enrichments` (phase 4).
- `eval/generated/*.json` become `generated` cases. `eval/misses.ts` is
  removed.
- `eval/run.ts` stays as a benchmark of the check engine itself (batching,
  tokens, and policies across every trait at once), not of individual traits.
  Its `fail` fixtures are also copied into cases for their traits.

## Phases

1. Case format, core scoring, the local runner, and `traits eval`. Cases are
   excluded from checks automatically. The scenario and generated cases are
   migrated, and the command is documented.
2. `traits eval --generate`, with near misses.
3. Derivation: the `cases` input, evaluation and refinement, workspace impact,
   `Unreliable`, saving cases, and progress notifications.
4. Comparisons: enrichments on and off, and several decision models in one
   report.

## Open questions

- **Generating cases for existing traits:** should this repository generate
  cases for all 166 existing traits once (one generation per trait, then
  evaluation), or only as traits change?
- **Bar for CI:** should CI use the strict bar from the start?
- **Case format:** directories with real files are readable and support
  multi-file cases, but every tool in the workspace must skip them. A single
  Markdown file per case, with one fenced block per file, avoids that and is
  written to a temporary directory to run. The directory form is the current
  choice.
