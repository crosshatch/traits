import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Array, Option } from "effect"
import { Atom } from "effect/reactivity"
import type { AnimationEvent, KeyboardEvent } from "react"

import { ActionBar } from "./ActionBar.tsx"
import { InstallCommand } from "./InstallCommand.tsx"
import { steps, type LifecycleStep } from "./LifecycleStep.ts"
import { LifecycleVisual } from "./LifecycleVisual.tsx"

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
const directionAtom = Atom.make<"forward" | "backward">("forward")
const playingAtom = Atom.make(true)
const walkthroughVisibleAtom = Atom.make(false)
const observeWalkthroughAtom = Atom.make((ctx) => {
  const walkthrough = document.querySelector(".walkthrough")
  if (walkthrough === null) return
  const observer = new IntersectionObserver(
    (entries) =>
      ctx.set(
        walkthroughVisibleAtom,
        Array.some(entries, (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.15)
      ),
    { threshold: 0.15 }
  )
  observer.observe(walkthrough)
  ctx.addFinalizer(() => observer.disconnect())
})
const selectStep = (ctx: Atom.FnContext, index: number) => {
  ctx.set(directionAtom, index < ctx(activeAtom) ? "backward" : "forward")
  ctx.set(activeAtom, index)
}
const selectStepAtom = Atom.family((index: number) => Atom.fnSync((_event: unknown, ctx) => selectStep(ctx, index)))
const stepAtom = Atom.family((count: 1 | -1) =>
  Atom.fnSync((_event: unknown, ctx) => selectStep(ctx, ctx(activeAtom) + count))
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
  selectStep(ctx, next)
  event.currentTarget.querySelector<HTMLAnchorElement>(`#step-${next}`)?.focus()
})
const advanceStepAtom = Atom.fnSync((event: AnimationEvent<HTMLDivElement>, ctx) => {
  if (event.animationName !== "step-progress") return
  ctx.set(directionAtom, "forward")
  ctx.set(activeAtom, (ctx(activeAtom) + 1) % steps.length)
})
const togglePlayingAtom = Atom.fnSync((_event: unknown, ctx) => ctx.set(playingAtom, !ctx(playingAtom)))

const StepTab = (props: { readonly step: LifecycleStep; readonly index: number }) => {
  const active = useAtomValue(activeAtom)
  const select = useAtomSet(selectStepAtom(props.index))
  return (
    <a
      href="#walkthrough"
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
    </a>
  )
}
const renderStep = (step: LifecycleStep, index: number) => <StepTab key={step.title} {...{ step, index }} />

export const App = () => {
  useAtomMount(observeChaptersAtom)
  useAtomMount(observeWalkthroughAtom)
  const chapter = useAtomValue(chapterAtom)
  const active = useAtomValue(activeAtom)
  const direction = useAtomValue(directionAtom)
  const playing = useAtomValue(playingAtom)
  const walkthroughVisible = useAtomValue(walkthroughVisibleAtom)
  const step = Array.getUnsafe(steps, active)
  const navigateSteps = useAtomSet(navigateStepsAtom)
  const advanceStep = useAtomSet(advanceStepAtom)
  const togglePlaying = useAtomSet(togglePlayingAtom)
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
            <h1 id="hero-title">Traits</h1>
            <p className="hero-description">
              <em className="hero-coda">Teach your agent to code like you</em>
            </p>
            <InstallCommand />
            <p className="eyebrow">Global desloppification</p>
            <p className="hero-byline">
              FROM{" "}
              <a href="https://x.com/CrosshatchDev" target="_blank" rel="noopener noreferrer">
                <img className="crosshatch-logo" src="/crosshatch-logo.svg" alt="" /> CROSSHATCH LABS{" "}
                <span aria-hidden="true">↗&#xfe0e;</span>
              </a>
            </p>
          </div>
        </section>
      </div>

      <main id="guide">
        <div className="contents-band">
          <span className="eyebrow">Table of contents</span>
          <a href="#lifecycle" aria-current={chapter === "lifecycle" ? "location" : undefined}>
            <span>I.</span> The loop
          </a>
          <a href="#tools" aria-current={chapter === "tools" ? "location" : undefined}>
            <span>II.</span> Two tools
          </a>
        </div>

        <div className="reading-area">
          <section className="chapter margin-blue" id="lifecycle" aria-labelledby="lifecycle-title">
            <div className="chapter-heading">
              <p className="eyebrow">Chapter I</p>
              <h2 id="lifecycle-title">The loop</h2>
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

            <div
              className="walkthrough"
              id="walkthrough"
              data-playing={playing ? "" : undefined}
              data-visible={walkthroughVisible ? "" : undefined}
            >
              <div
                className="step-tabs"
                role="tablist"
                aria-label="Trait lifecycle"
                onKeyDown={navigateSteps}
                onAnimationEnd={advanceStep}
              >
                {Array.map(steps, renderStep)}
              </div>
              <div
                className="step-panel"
                id="step-panel"
                role="tabpanel"
                aria-labelledby={`step-${active}`}
                data-direction={direction}
              >
                <div className="step-details" key={`copy-${active}`}>
                  <span className="eyebrow">
                    Observation {active + 1} of {steps.length}
                  </span>
                  <h3>{step.heading}</h3>
                  <p>{step.description}</p>
                  <p className="margin-note">{step.note}</p>
                </div>
                <LifecycleVisual key={`visual-${active}`} {...{ step }} index={active} />
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
                <button type="button" className="step-autoplay" onClick={togglePlaying}>
                  <span aria-hidden="true">{playing ? "❚❚" : "▶"}</span> {playing ? "Pause" : "Play"}
                </button>
                {active < steps.length - 1 ? (
                  <button type="button" onClick={nextStep} aria-label="Next lifecycle step">
                    Next <span className="step-controls-detail">observation</span> →
                  </button>
                ) : (
                  <a href="#tools">Meet the instruments →</a>
                )}
              </div>
            </div>
            <aside className="book-note">
              <span className="eyebrow">A note</span>
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
                  Use <code>traitNames</code> for a focused review. Overlapping matches are deduplicated, while
                  unmatched patterns review nothing.
                </p>
              </article>
            </div>
          </section>

          <div className="closing">
            <img className="hero-emblem" src="/traits-emblem.svg" width="360" height="420" alt="" />
            <p>GLOBAL DESLOPPIFICATION</p>
            <a className="read-link" href="#top">
              Back to top ↑
            </a>
          </div>
          <ActionBar docked />
        </div>
      </main>
    </>
  )
}
