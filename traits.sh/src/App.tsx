import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Array, Option } from "effect"
import { Atom } from "effect/reactivity"
import type { KeyboardEvent } from "react"

import { ActionBar } from "./ActionBar.tsx"
import { CodeSample } from "./CodeSample.tsx"
import { BrokenQuill, DriftingLeaf, Flourish, LaurelSeal, MistLantern } from "./Illustrations.tsx"
import { InstallCommand } from "./InstallCommand.tsx"
import { steps, type LifecycleStep } from "./LifecycleStep.ts"
import { LifecycleVisual } from "./LifecycleVisual.tsx"
import { setupPrompt } from "./SetupPrompt.ts"

const repository = "https://github.com/crosshatch/traits"
const stepNumerals = ["i", "ii", "iii", "iv", "v", "vi", "vii"] as const
const activeAtom = Atom.make(0)
const chapterAtom = Atom.make<string | undefined>(undefined)
const observeChaptersAtom = Atom.make((ctx) => {
  const updateChapter = () => {
    const readingLine = window.innerHeight * 0.3
    const chapter = Array.findLast(document.querySelectorAll<HTMLElement>(".chapter"), (element) => {
      const bounds = element.getBoundingClientRect()
      return bounds.top <= readingLine && bounds.bottom > readingLine
    }).pipe(Option.getOrUndefined)
    ctx.set(chapterAtom, chapter?.id)
  }
  let frame = requestAnimationFrame(updateChapter)
  const scheduleUpdate = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(updateChapter)
  }
  window.addEventListener("scroll", scheduleUpdate, { passive: true })
  window.addEventListener("resize", scheduleUpdate)
  ctx.addFinalizer(() => {
    cancelAnimationFrame(frame)
    window.removeEventListener("scroll", scheduleUpdate)
    window.removeEventListener("resize", scheduleUpdate)
  })
})
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

export const App = () => {
  useAtomMount(observeChaptersAtom)
  const chapter = useAtomValue(chapterAtom)
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
      <div className="opening" id="top">
        <ActionBar />
        <section className="hero margin-coral" aria-labelledby="hero-title">
          <div className="hero-content">
            <img
              className="hero-emblem"
              src="/traits-emblem.svg"
              width="360"
              height="420"
              alt="An ornamental T surrounded by an ivy flourish and a returning feedback loop."
            />
            <p className="eyebrow">Global desloppification</p>
            <h1 id="hero-title">Traits</h1>
            <InstallCommand />
            <p className="hero-description">
              Your agent learns from your feedback.
              <em className="hero-coda">And corrects itself with subsequent generations.</em>
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
          <a href="#lifecycle" aria-current={chapter === "lifecycle" ? "location" : undefined}>
            <span>I.</span> The loop
          </a>
          <a href="#tools" aria-current={chapter === "tools" ? "location" : undefined}>
            <span>II.</span> Two tools
          </a>
          <a href="#begin" aria-current={chapter === "begin" ? "location" : undefined}>
            <span>III.</span> Manual
          </a>
        </div>

        <div className="reading-area">
          <section className="chapter margin-blue" id="lifecycle" aria-labelledby="lifecycle-title">
            <div className="chapter-heading">
              <p className="eyebrow">Chapter I</p>
              <h2 id="lifecycle-title">The loop</h2>
              <Flourish />
            </div>
            <div className="prose lead">
              <p>
                <span className="drop-cap">W</span>ork with your agent. Context emerges from each conversation and
                correction.
              </p>
              <p>
                As you work, your agent asks which insights to keep as traits. The traits that you approve become the
                context that guards the quality of your future work.
              </p>
              <p>
                Decision models check subsequent code generation against all your traits, flagging ignored traits and
                nuances for the agent to fix.
              </p>
            </div>

            <div className="walkthrough">
              <div className="step-tabs" role="tablist" aria-label="Trait lifecycle" onKeyDown={navigateSteps}>
                {Array.map(steps, renderStep)}
              </div>
              <div className="step-panel" id="step-panel" role="tabpanel" aria-labelledby={`step-${active}`}>
                <div className="step-copy">
                  <div className="step-details" key={`copy-${active}`}>
                    <span className="eyebrow">
                      Observation {active + 1} of {steps.length}
                    </span>
                    <h3>{step.heading}</h3>
                    <p>{step.description}</p>
                    <p className="margin-note">{step.note}</p>
                  </div>
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
                <LifecycleVisual key={`visual-${active}`} {...{ step }} index={active} />
              </div>
            </div>
            <aside className="book-note">
              <span className="eyebrow">A footnote</span>
              <p>
                Traits are not immutable laws. You can clarify a trait when the wording is too broad and reconcile it
                when a new preference conflicts.
              </p>
            </aside>
          </section>

          <section className="chapter margin-gold" id="tools" aria-labelledby="tools-title">
            <div className="chapter-heading">
              <p className="eyebrow">Chapter II</p>
              <h2 id="tools-title">Two tools</h2>
              <Flourish />
            </div>
            <div className="prose lead">
              <p>
                <span className="drop-cap">T</span>wo MCP tools do the practical work. One curates the collection of
                traits while the other checks the code against the traits.
              </p>
            </div>
            <div className="instruments">
              <article>
                <span className="instrument-number">01 / Remember</span>
                <h3>
                  <code>derive_trait</code>
                </h3>
                <p>
                  Compare a proposed trait with the collection. A distinct trait can be saved and an existing trait can
                  be reused or clarified. Confirmed conflicts lead to an explicit reconciliation approval.
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
                  Use traitIds for a focused review. Overlapping matches are deduplicated, while unmatched patterns
                  review nothing.
                </p>
              </article>
            </div>

            <div className="judgment">
              <span className="eyebrow">Reading an assessment</span>
              <h3>The LLM proposes traits. Decision models ensure the traits are followed.</h3>
              <p className="assessment-intro">
                Keep the review moving in both directions: decision models check newly generated code against all
                existing traits, and check the existing codebase against each newly saved trait. The agent selects the
                files and traits for each review. By revisiting the new code or the new trait, we keep decision-model
                token costs down while maintaining coverage as the work grows.
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
                Probabilities from decision models expose uncertainty, but judgments can still be wrong.
              </p>
            </div>
          </section>

          <section className="chapter margin-green" id="begin" aria-labelledby="begin-title">
            <div className="chapter-heading">
              <p className="eyebrow">Chapter III</p>
              <h2 id="begin-title">Manual</h2>
              <Flourish />
            </div>
            <div className="prose lead">
              <p>
                <span className="drop-cap">Y</span>our agent handles the setup. Just start from your existing Git
                checkout. There aren’t any new package manager habits to learn or config files to copy over by hand.
              </p>
            </div>
            <div className="setup-grid">
              <div>
                <span className="eyebrow">01 / Paste the prompt</span>
                <h3>Let your agent handle the details.</h3>
                <p>
                  Copy this prompt into your coding agent. The setup guide covers dependencies, configuration, the
                  Traits skill, and the MCP connection while respecting your workspace and existing settings.
                </p>
                <p>
                  Choose your providers and models when asked, then supply their credentials privately. Your agent
                  verifies the connection and tells you if anything still needs your attention.
                </p>
                <a className="text-link" href={`${repository}/blob/main/SETUP.md`}>
                  Setup guide &amp; troubleshooting ↗
                </a>
              </div>
              <CodeSample title="agent prompt · set up Traits" code={setupPrompt} />
            </div>
            <div className="practice-list">
              <div>
                <span>i.</span>
                <p>
                  <strong>Paste the prompt.</strong> Your agent reads the guide and follows your project’s conventions.
                </p>
              </div>
              <div>
                <span>ii.</span>
                <p>
                  <strong>Choose your models.</strong> Tell your agent which providers to use for decisions and language
                  generation.
                </p>
              </div>
              <div>
                <span>iii.</span>
                <p>
                  <strong>Supply credentials privately.</strong> Keep keys out of chat and source control. Your agent
                  explains where to put them and verifies what it can.
                </p>
              </div>
            </div>
            <div className="closing">
              <Flourish />
              <img className="hero-emblem" src="/traits-emblem.svg" width="360" height="420" alt="" />
              <p>Global desloppification.</p>
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
