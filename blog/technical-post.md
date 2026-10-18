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

## Drafting and judging are different jobs

**The LLM.** When you correct your agent, it proposes a trait. A trait is a
short Markdown file stating one preference, scoped by when it applies and which
file types it covers. Your LLM compresses a correction into a clear, generalized
rule and compares it with existing rules and phrases conflicts for you to
resolve if necessary. LLMs are generally excellent at synthesis and reasoning.

**The System One model.** Your LLM feeds the decision model a 200-line chunk of
code to check against your traits library. The System One model decides whether
the code is `compliant`, in `violation`, or if the results are `inconclusive`.
System One models are designed precisely for this type of classification task,
where they can make hundreds of small judgments and return a set of
probabilities for each scenario.

Relying on LLMs for classification creates three problems:

**The output is a paragraph.** An LLM judge outputs prose that you have to parse
into a verdict. The verdict can drift with phrasing, temperature, and whatever
the model decided to emphasize that run. It may include caveats that contradict
your rulesets.

**Confidence is self-reported.** You can ask an LLM how sure it is, but that
number is more generated text. LLMs have a proven tendency toward
overconfidence, and there's no principled way to tell a confident violation from
a coin flip.

**The judge grades its own homework.** If the same model family writes the code
and reviews it, you inherit its blind spots twice. LLM-as-judge setups are known
to favor outputs that look like their own.

## What a check actually looks like

In Traits, every (code chunk, trait) pair becomes a classification question with
four fixed labels:

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

The decision model, TypeSafe's Jev by default, doesn't write an answer. It
returns a probability for each label. Traits takes the top label as the
classification, keeps the full distribution, and only surfaces `violation` and
`inconclusive` results to the agent. The agent then inspects the evidence, fixes
confirmed issues, and re-checks the file.

**`inconclusive` represents a judgement of insufficient evidence.** A 200-line
chunk is a window into a larger file. Sometimes a rule applies, but whether the
code follows it depends on something offscreen. The instructions explicitly tell
the model not to invent surrounding code or assume unseen dependencies are
absent. Instead of guessing, it can say it doesn't know, and the agent knows to
look wider. LLMs avoid inconclusive outputs because they are trained to present
users with a satisfying answer.

**`not-applicable` keeps the trait set scalable.** Most traits don't apply to
most chunks. A rule about React state has nothing to say about a database
migration. You can check every chunk against every trait without worrying about
false positives.

Instructions are deliberately conservative in other contexts as well. Code,
comments, and string literals are treated as evidence, which blunts prompt
injection from the codebase being reviewed. Merely mentioning a forbidden
pattern in a comment or a test name isn't a violation.

## Probabilities change what the agent does

Every verdict comes with a probability distribution. A violation at 0.95 and a
violation at 0.52 are different situations, and the agent can treat them
differently. It will fix the first violation, but it may search for more context
before fixing the second violation.

While linters handle deterministic rules, most coding preferences are
non-deterministic. Something needs to make a judgment call about whether a
helper is small enough to inline or whether an import style fits an API. These
also represent the edge cases developers typically have to either revise in
review or guide models through with additional prompts. A calibrated sense of
uncertainty in an edge case is significantly more useful than an overconfident
(and wrong) string of text.

## The economics

The architecture also makes coverage more affordable than sponsoring a debate
between agents and requiring additional prompts before the agent arrives at the
desired outcome. Traits checks new code against every existing trait, and, when
you save a new trait, it checks existing code against that trait. With a
complete trait library for a codebase, you can approach standards alignment and
code quality that was previously not possible.

A recent Jev bill after 2 full days of development was $4.78 for 117.7 million
tokens across 47.4k requests. Running the same volume through a frontier LLM at
typical input pricing would cost hundreds of dollars, not including the output
tokens.

A few engineering choices keep the request count reasonable:

- **Chunking:** files are read in 200-line chunks, so each question sees a
  bounded excerpt with its file path and starting line.
- **Batching:** up to 16 trait questions are packed into a single decision
  request per chunk, within a fixed request budget, and batches run
  concurrently.
- **Incremental reviews:** each review targets new code or a new trait, so cost
  scales with the diff.
- **Explicit exceptions:** a `traits-ignore-file` comment with a reason skips a
  named trait for one file.

## What can still go wrong

Calibrated probabilities don't represent a correct answer. A 90% verdict will be
wrong about one time in ten. That's why the agent verifies findings instead of
blindly applying them. Humans still need to review the code; however, outputs
are easier to follow, and corrections become less common with each turn.

Bad traits produce bad checks. If a trait is worded too broadly, the model will
enforce the overbroad version. As you build a traits library, you'll naturally
narrow or reconcile wording for poorly phrased traits.

Model versions also move. Our default config uses `jev-latest`. If you want
reproducible results, for example in CI, pin a specific model version.

## The general lesson

The pattern extends beyond code review. When an agent pipeline needs a judgment,
ask whether the judgment is really generation or really classification. If it's
classification, a model built to classify will tell you how sure it is, cost a
fraction as much, and stop you from grading an LLM's work with the same kind of
model that produced it.

Traits is open source at
[github.com/crosshatch/traits](https://github.com/crosshatch/traits), with an
overview at [traits.sh](https://traits.sh). The decision logic described here
lives in `traits/TraitEvaluation.ts`.
