# Don't Be Sloppy: how Traits guides your agent to write code the way you would write it

If you work with a coding agent every day, you have probably typed the same correction more than once.

*Use the case guard, not a manual tag check. Don't wrap that callback in an arrow. Catch errors by tag.*

Your agent fixes it, the session ends, and next week it writes the same thing again. Code technically misaligned with your standards might pass a review because you either don't notice it or the violation isn't flagrant enough to warrant another pass. Still, it doesn't feel like your code.

Traits is an open-source tool from Crosshatch Labs that turns that feedback into durable, reviewable preferences, then uses decision models to check new code against them. This post walks through how it works.

## A trait is a small Markdown file

A trait is one coding preference, stored as plain text in `.agents/traits` next to your code. Here is one from the Traits repo itself:

```markdown
---
id: 70c6403e-0028-4443-bc07-9ec0f769ef16
name: catch-tags-for-tagged-errors
when: recovering from tagged Effect errors.
mime: [text/typescript, text/tsx]
---
Always prefer Effect.catchTags over Effect.catchTag for tagged-error
recovery, including when handling only one error tag:
Effect.catchTags({ UnknownError: handler }), not
Effect.catchTag("UnknownError", handler). Preserve the existing handlers and
error propagation behavior.
```

The preference is stated in the body, and the frontmatter identifies and scopes it. `id` is a stable UUID and `name` is a readable label that also prefixes the filename. `when` says what situation the trait governs, and `mime` limits which file types it applies to. An optional `skip` field carves out an exception within that scope. Because traits are ordinary files, you can read them, edit them by hand, review them in pull requests, and share them with your team.

## Remembering: `derive_trait`

Traits connects to your agent over MCP and exposes two tools. The first, `derive_trait`, handles the remembering side.

When you correct the agent, it can propose a trait from that correction. The tool compares the proposal with the traits you already have. A distinct preference can be saved as new. A near-duplicate can reuse or clarify an existing trait instead of piling up a second version. If the new preference genuinely conflicts with an old one, Traits surfaces the conflict and asks you to approve an explicit reconciliation.

An example workflow looks like:

1. You make a correction
2. Your agent proposes a new trait
3. You approve the trait, edit it, or dismiss the trait if it's a one-off correction
4. Next time your agent drifts, `check_traits` flags it, and the agent corrects the mistake before you see it

Most coding preferences are non-deterministic in nature. For example, it's a judgment call whether a helper is small enough to inline or an import style fits the API. System One decision models, like Jev, return probabilities for every label, making them an ideal tool for quality checks. The traits themselves aren't fixed laws either. You can narrow wording deemed too broad or update preferences when your conventions change.

## Reviewing: `check_traits`

The second tool, `check_traits`, enforces your preferences. The agent picks files or glob patterns and, optionally, specific trait IDs. Traits reads the current file contents in 200-line chunks and asks a decision model to assess each chunk against each relevant trait.

With Traits, the important design choice is the split between models. A language model drafts traits, because drafting is a writing task. A separate decision model does the checking, because checking is a classification task. Each trait becomes a classification question with four possible answers:

- **Compliant:** the trait applies, and the code follows it.
- **Not applicable:** the excerpt contains nothing the trait governs.
- **Violation:** the excerpt demonstrates a breach.
- **Inconclusive:** the trait applies but can't be judged without more context.

Every assessment outputs probabilities for all four labels, exposing uncertainty for each decision. Only violations and inconclusive results are returned to the agent for attention. The agent then inspects the evidence, fixes confirmed issues, and re-checks the changed file.

The prompt behind each check is deliberately conservative. Code, comments, and string literals are treated as evidence, which blunts prompt injection from the codebase. Merely mentioning a forbidden pattern isn't a violation. The model is also told not to invent surrounding code it can't see, which is what the inconclusive label is for.

Under the hood, Traits batches up to 16 trait questions into a single decision request per chunk, capped at 24 KB per request, and runs batches concurrently. If a file needs a deliberate exception, a comment at the top of the file skips a trait for that file. It names the trait by UUID or name and must include a reason:

```ts
// traits-ignore-file catch-tags-for-tagged-errors: this adapter mirrors an upstream API that uses catchTag.
```

## Checking in both directions

Coverage runs both ways. New code is checked against all existing traits. When you save a new trait, the existing codebase can be checked against it, so a preference you adopt today could be applied across your whole codebase. Because each review targets only the new code or trait, decision model costs stay proportional to the files you touch rather than to the repo size. Also, as you've probably noticed if you've experimented with System One models, they're crazy cheap in comparison to the frontier LLMs (a recent Jev bill of ours was $3.49 for 85M tokens and 38k requests).

## Setup is a prompt

There is no installer to learn. You paste one prompt into your coding agent:

> Set up Traits using https://github.com/crosshatch/traits/blob/main/SETUP.md.
> Follow this project's conventions, ask me to choose providers and models, and
> preserve existing configuration.

The setup guide is written for the agent. It tells it to respect your package manager, workspace settings, and lockfiles. It asks which providers you want, ensures that you keep API keys out of chat and source control, installs the Traits skill where your specific agent discovers it, and connects the MCP server. The result is a small `traits.ts` at your repo root:

```ts
export default {
  layerDecisionModel: TypeSafeDecisionModel.layer({ model: "jev-latest" }).pipe(
    Layer.provide(TypeSafeClient.layerConfig())
  ),
  layerLanguageModel: OpenAiLanguageModel.layer({ model: "gpt-6.1-sol" }).pipe(
    Layer.provide(OpenAiClient.layerConfig({ apiKey: Config.Redacted("OPENAI_API_KEY") }))
  )
} satisfies TraitsConfig
```

The defaults are TypeSafe's Jev for decisions and an OpenAI model for language, but both are swappable for any Effect provider that supplies the right service.

## Built with itself

The Traits repo uses Traits. Its `.agents/traits` folder holds more than 70 preferences accumulated while building the tool, covering Effect error handling, pipeline style, React state, testing philosophy, and more. It's a useful look at what a mature trait collection reads like in practice.

We encourage developers to build communities around trait libraries for different stacks or needs, like security or DevOps.

## What it isn't

Obviously, you still need to review any agent's generated code. It will still get things wrong and we don't like slop. However, we've found that the more we iterate, and the more comprehensive our trait library becomes, the more we spend our reviews admiring the code because it's written in our own voice.

## Try it

The source is at [github.com/crosshatch/traits](https://github.com/crosshatch/traits), the package is [`traits`](https://www.npmjs.com/package/traits) on npm, and we have a basic overview at [traits.sh](https://traits.sh). You can also join our [Discord server](https://discord.gg/CSXCRUKjh9) or follow us on [X](https://x.com/CrosshatchDev).

Paste the setup prompt, correct your agent the next time it gets something wrong, and approve the trait it proposes. The next generation of code should already know. Every new Traits connoisseur brings the world closer to global desloppification.
