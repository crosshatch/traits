import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Array, String } from "effect"
import { Atom } from "effect/reactivity"
import type { KeyboardEvent } from "react"

import { ActionBar } from "./ActionBar.tsx"
import { CodeSample } from "./CodeSample.tsx"
import { BrokenQuill, DriftingLeaf, Flourish, LaurelSeal, MistLantern } from "./Illustrations.tsx"
import { InstallCommand } from "./InstallCommand.tsx"
import { steps, type LifecycleStep } from "./LifecycleStep.ts"
import { LifecycleVisual } from "./LifecycleVisual.tsx"

const repository = "https://github.com/crosshatch/traits"
const stepNumerals = ["i", "ii", "iii", "iv", "v", "vi", "vii"] as const
const activeAtom = Atom.make(0)
const selectStepAtom = Atom.family((index: number) => Atom.fnSync((_event: unknown, ctx) => ctx.set(activeAtom, index)))
const stepAtom = Atom.family((count: 1 | -1) =>
  Atom.fnSync((_event: unknown, ctx) => ctx.set(activeAtom, ctx(activeAtom) + count))
)
const navigateStepsAtom = Atom.fnSync((event: KeyboardEvent<HTMLDivElement>, ctx) => {
  const active = ctx(activeAtom)
  let next = active
  if (event.key === "ArrowRight") next = (active + 1) % steps.length
  else if (event.key === "ArrowLeft") next = (active + steps.length - 1) % steps.length
  else if (event.key === "Home") next = 0
  else if (event.key === "End") next = steps.length - 1
  else return
  event.preventDefault()
  ctx.set(activeAtom, next)
  event.currentTarget.querySelector<HTMLButtonElement>(`#step-${next}`)?.focus()
})

const StepTab = (props: { readonly step: LifecycleStep; readonly index: number }) => {
  const active = useAtomValue(activeAtom)
  const select = useAtomSet(selectStepAtom(props.index))
  return (
    <button
      type="button"
      role="tab"
      id={`step-${props.index}`}
      aria-selected={active === props.index}
      aria-controls="step-panel"
      tabIndex={active === props.index ? 0 : -1}
      onClick={select}
    >
      <span className="step-number" aria-hidden="true">
        {Array.getUnsafe(stepNumerals, props.index)}.
      </span>
      <span>{props.step.title}</span>
    </button>
  )
}
const renderStep = (step: LifecycleStep, index: number) => <StepTab key={step.title} {...{ step, index }} />

const connectionExample = String.stripMargin(`
| {
|   "mcp": {
|     "servers": {
|       "traits": {
|         "type": "local",
|         "command": ["npx", "-y", "traits"]
|       }
|     }
|   }
| }
`)

const initializeExample = String.stripMargin(`
|npx traits init
|
|# Creates config at the checkout root:
|# traits.ts
|
|# Install the skill with pnpm 12.11+:
|pnpm add -D traits
|pnpm approve
|
|# Other package managers: install traits locally, then:
|npx skills add ./node_modules/traits --skill traits
`)

const providersExample = String.stripMargin(`
|pnpm add effect @effect/ai-openai @effect/ai-typesafe
|
|# Review the generated traits.ts:
|# export default { ... } satisfies TraitsConfig · import type from "traits"
|# layerDecisionModel · TypeSafe
|# layerLanguageModel · OpenAI
|# excludes · files to omit from review
`)

const credentialsExample = String.stripMargin(`
|TYPESAFE_API_KEY=your_typesafe_api_key
|OPENAI_API_KEY=your_openai_api_key
`)

export const App = () => {
  const active = useAtomValue(activeAtom)
  const step = Array.getUnsafe(steps, active)
  const navigateSteps = useAtomSet(navigateStepsAtom)
  const previousStep = useAtomSet(stepAtom(-1))
  const nextStep = useAtomSet(stepAtom(1))

  return (
    <>
      <a className="skip-link" href="#guide">
        Skip to the field guide
      </a>
      <div className="opening">
        <ActionBar />
        <section className="hero margin-coral" id="top" aria-labelledby="hero-title">
          <div className="hero-content">
            <img
              className="hero-emblem"
              src="/traits-emblem.svg"
              width="360"
              height="420"
              alt="An ornamental T surrounded by an ivy flourish and a returning feedback loop."
            />
            <p className="eyebrow">Categorically eliminate slop forever</p>
            <h1 id="hero-title">Traits</h1>
            <InstallCommand />
            <p className="hero-description">
              Your agent learns from your feedback—and remembers.
              <em className="hero-coda">A little wiser with every generation.</em>
            </p>
            <p className="hero-byline">
              BY{" "}
              <a href="https://x.com/CrosshatchDev" target="_blank" rel="noopener noreferrer">
                CROSSHATCH LABS <span aria-hidden="true">↗</span>
              </a>
            </p>
          </div>
        </section>
      </div>

      <main id="guide">
        <div className="contents-band">
          <span className="eyebrow">Contents of this little volume</span>
          <a href="#lifecycle">
            <span>I.</span> From feedback to habit
          </a>
          <a href="#tools">
            <span>II.</span> Two tools. That's it.
          </a>
          <a href="#begin">
            <span>III.</span> Manual Setup
          </a>
        </div>

        <div className="reading-area">
          <section className="chapter margin-blue" id="lifecycle" aria-labelledby="lifecycle-title">
            <div className="chapter-heading">
              <p className="eyebrow">Chapter I</p>
              <h2 id="lifecycle-title">From feedback to habit.</h2>
              <Flourish />
            </div>
            <div className="prose lead">
              <p>
                <span className="drop-cap">G</span>ood work is full of small corrections. Each of those corrections
                bears a generalizable insight. Left in a conversation, those insights are forgotten. Traits ensure your
                agent can access those insights moving forward.
              </p>
              <p>
                Not a transcript. Not a giant system prompt. A concise trait, a clear scope, and just enough of an
                example to show what “better” looks like. With each generation, a decision model of your choosing
                validates chunks against your trait catalog and reports likely mistakes back to your agent for
                correction.
              </p>
            </div>

            <div className="walkthrough">
              <div className="step-tabs" role="tablist" aria-label="Trait lifecycle" onKeyDown={navigateSteps}>
                {Array.map(steps, renderStep)}
              </div>
              <div className="step-panel" id="step-panel" role="tabpanel" aria-labelledby={`step-${active}`}>
                <div className="step-copy">
                  <span className="eyebrow">
                    Observation {active + 1} of {steps.length}
                  </span>
                  <h3>{step.heading}</h3>
                  <p>{step.description}</p>
                  <p className="margin-note">{step.note}</p>
                  <div className="step-controls">
                    <button
                      type="button"
                      disabled={active === 0}
                      onClick={previousStep}
                      aria-label="Previous lifecycle step"
                    >
                      ← Previous
                    </button>
                    {active < steps.length - 1 ? (
                      <button type="button" onClick={nextStep}>
                        Next observation →
                      </button>
                    ) : (
                      <a href="#tools">Meet the instruments →</a>
                    )}
                  </div>
                </div>
                <LifecycleVisual {...{ step }} />
              </div>
            </div>
            <aside className="book-note">
              <span className="eyebrow">A note in the margin</span>
              <p>
                Traits are not immutable laws. Clarify a trait when the wording is too broad. Reconcile it when a new
                preference conflicts. Keep the useful parts, ask before replacing anything, and let the next lesson
                improve the last.
              </p>
            </aside>
          </section>

          <section className="chapter margin-gold" id="tools" aria-labelledby="tools-title">
            <div className="chapter-heading">
              <p className="eyebrow">Chapter II</p>
              <h2 id="tools-title">Two tools. That's it.</h2>
              <Flourish />
            </div>
            <div className="prose lead">
              <p>
                <span className="drop-cap">T</span>wo MCP tools do the practical work. One tends the collection of
                traits. The other asks whether the code lives up to them.
              </p>
            </div>
            <div className="instruments">
              <article>
                <span className="instrument-number">01 / Remember</span>
                <h3>
                  <code>derive_trait</code>
                </h3>
                <p>
                  Compare a proposed trait with the collection. A distinct trait can be saved; an existing trait can be
                  reused or clarified. Confirmed conflicts lead to an explicit reconciliation approval.
                </p>
                <p className="small-note">
                  Creation and changes require approval. Created, Updated, and Resolved include saved traits and their
                  IDs.
                </p>
              </article>
              <article>
                <span className="instrument-number">02 / Review</span>
                <h3>
                  <code>check_traits</code>
                </h3>
                <p>
                  Select files or glob patterns. The tool reviews current contents in 200-line chunks, compares them
                  with the selected traits, and returns assessments that need attention.
                </p>
                <p className="small-note">
                  Use traitIds for a focused review. Overlapping matches are deduplicated; unmatched patterns review
                  nothing.
                </p>
              </article>
            </div>

            <div className="judgment">
              <span className="eyebrow">Reading an assessment</span>
              <h3>The LLM proposes traits. Decision models use traits to keep the LLM honest.</h3>
              <p className="assessment-intro">
                Keep the review moving in both directions: decision models check newly generated code against all
                existing traits, and check the existing codebase against each newly saved trait. The agent selects the
                files and traits for each review. By revisiting the new code or the new trait—not every unchanged
                code-and-trait pairing—we keep decision-model token costs down while maintaining coverage as the work
                grows.
              </p>
              <div className="verdict-grid">
                <div>
                  <LaurelSeal />
                  <h4>Compliant</h4>
                  <p>The trait applies and the supplied code follows it.</p>
                </div>
                <div>
                  <DriftingLeaf />
                  <h4>Not applicable</h4>
                  <p>This excerpt does not contain behavior governed by the trait.</p>
                </div>
                <div>
                  <BrokenQuill />
                  <h4>Violation</h4>
                  <p>Inspect the evidence. Fix confirmed issues and review the changed file again.</p>
                </div>
                <div>
                  <MistLantern />
                  <h4>Inconclusive</h4>
                  <p>Something is missing or ambiguous. This is not a confirmed violation.</p>
                </div>
              </div>
              <p className="small-note">
                Probabilities expose uncertainty; they are not guarantees. Model judgments can be wrong. Quietly reject
                irrelevant findings, but never quietly ignore an actual problem.
              </p>
            </div>
          </section>

          <section className="chapter margin-green" id="begin" aria-labelledby="begin-title">
            <div className="chapter-heading">
              <p className="eyebrow">Chapter III</p>
              <h2 id="begin-title">Manual Setup</h2>
              <Flourish />
            </div>
            <div className="prose lead">
              <p>
                <span className="drop-cap">B</span>egin with a local collection and a coding agent. The traits remain
                readable Markdown, the choices remain yours, and the next review starts with something better than a
                half-remembered chat.
              </p>
            </div>
            <div className="setup-grid">
              <div>
                <span className="eyebrow">01 / Initialize</span>
                <h3>Create the config and install the skill.</h3>
                <p>
                  Run <code>npx traits init</code> anywhere inside your Git checkout. It writes <code>traits.ts</code>{" "}
                  at the current checkout root—not in the directory you happen to be in. In a linked worktree, the
                  config stays in that worktree. Existing files are left untouched.
                </p>
                <p>
                  Install the bundled skill separately: pnpm 12.11+ links approved skills from your Traits dependency;
                  other package managers can use the skills CLI to choose their agents. Initialization does not install
                  dependencies or skills. Trait files are saved later, after your approval.
                </p>
                <p>
                  pnpm needs an existing agent skill directory or an explicit <code>skills.dirs</code> setting. Global
                  installs and <code>pnpm dlx</code> do not link skills. The skills CLI installs a snapshot; rerun it
                  after updating Traits. Back up customizations before replacing older skill copies, and avoid loading
                  both.
                </p>
              </div>
              <CodeSample title="terminal · initialize the checkout" code={initializeExample} />
            </div>
            <div className="setup-grid">
              <div>
                <span className="eyebrow">02 / Configure providers</span>
                <h3>Choose the models that do the work.</h3>
                <p>
                  Install the packages imported by the generated <code>traits.ts</code> in your project. Initialization
                  creates the config; it does not install these dependencies.
                </p>
                <p>
                  The default config uses TypeSafe for decisions and OpenAI for language generation. Review the model
                  choices and file exclusions, or replace the provider layers with your own.
                </p>
              </div>
              <CodeSample title="terminal · provider dependencies" code={providersExample} />
            </div>
            <div className="setup-grid">
              <div>
                <span className="eyebrow">03 / Credentials</span>
                <h3>Give the providers their keys.</h3>
                <p>
                  For the default providers, set <code>TYPESAFE_API_KEY</code> and <code>OPENAI_API_KEY</code> in the
                  MCP process environment or a root <code>.env</code> file. Replace the example values with your own
                  keys.
                </p>
                <p>
                  Process environment values take precedence, followed by the worktree’s <code>.env</code>, then the
                  main checkout’s <code>.env</code>. Keep credentials out of source control and reconnect the server
                  after changing them.
                </p>
              </div>
              <CodeSample title=".env · keep private" code={credentialsExample} copyable={false} />
            </div>
            <div className="setup-grid">
              <div>
                <span className="eyebrow">04 / Connect your agent</span>
                <h3>Start the local MCP server.</h3>
                <p>
                  Configure your coding agent to run <code>npx -y traits</code> with the checkout root as its working
                  directory. It loads <code>traits.ts</code> from that checkout. The example shows OpenCode’s local MCP
                  configuration; merge it into your existing settings.
                </p>
                <p>
                  Connect the server and confirm that <code>derive_trait</code> and <code>check_traits</code> are
                  available. Make sure your agent discovers the installed skill, then start with a useful correction.
                </p>
                <a className="text-link" href={repository}>
                  Explore the implementation ↗
                </a>
              </div>
              <CodeSample title="opencode.json · local MCP server" code={connectionExample} />
            </div>
            <div className="practice-list">
              <div>
                <span>i.</span>
                <p>
                  <strong>Notice preferences as they happen.</strong> A correction or approved alternative idiom can be
                  worth keeping. Skip transient instructions.
                </p>
              </div>
              <div>
                <span>ii.</span>
                <p>
                  <strong>Make the choice explicit.</strong> Review the proposal, revise it if needed, and approve the
                  exact trait or replacement plan.
                </p>
              </div>
              <div>
                <span>iii.</span>
                <p>
                  <strong>Close the loop.</strong> Check changed TypeScript, fix genuine violations, and rerun the
                  relevant checks before committing.
                </p>
              </div>
            </div>
            <div className="closing">
              <Flourish />
              <p>
                Every conversation leaves a little wisdom.
                <br />
                <em>Let the next generation inherit it.</em>
              </p>
              <a className="read-link" href="#top">
                Back to top ↑
              </a>
            </div>
          </section>
          <ActionBar docked />
        </div>
      </main>
    </>
  )
}
