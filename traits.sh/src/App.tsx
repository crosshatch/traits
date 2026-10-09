import { Array, String } from "effect"
import { useState, type KeyboardEvent } from "react"

import { CodeSample } from "./CodeSample.tsx"
import { Flourish } from "./Illustrations.tsx"
import { InstallCommand } from "./InstallCommand.tsx"
import { steps } from "./LifecycleStep.ts"
import { ThemeToggle } from "./ThemeToggle.tsx"

const repository = "https://github.com/harrysolovay/crosshatch-next"

const connectionExample = String.stripMargin(`
| {
|   "mcp": {
|     "servers": {
|       "traits": {
|         "type": "local",
|         "command": ["node", "traits/main.ts"]
|       }
|     }
|   }
| }
`)

export const App = () => {
  const [active, setActive] = useState(0)
  const step = Array.getUnsafe(steps, active)
  const navigateSteps = (event: KeyboardEvent<HTMLDivElement>) => {
    let next = active
    if (event.key === "ArrowRight") next = (active + 1) % steps.length
    else if (event.key === "ArrowLeft") next = (active + steps.length - 1) % steps.length
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = steps.length - 1
    else return
    event.preventDefault()
    setActive(next)
    event.currentTarget.querySelector<HTMLButtonElement>(`#step-${next}`)?.focus()
  }

  return (
    <>
      <a className="skip-link" href="#guide">
        Skip to the field guide
      </a>
      <header className="masthead">
        <a className="brand" href="#top" aria-label="Traits, back to top">
          <img className="emblem" src="/traits-mark.svg" width="48" height="48" alt="" />
          <span>TRAITS</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#lifecycle">The lifecycle</a>
          <a href="#tools">The tools</a>
          <a href="#begin">Begin</a>
          <a className="source-link" href={repository}>
            Source <span aria-hidden="true">↗</span>
          </a>
          <ThemeToggle />
        </nav>
      </header>

      <main id="guide">
        <section className="hero margin-coral" id="top" aria-labelledby="hero-title">
          <img
            className="hero-emblem"
            src="/traits-emblem.svg"
            width="360"
            height="420"
            alt="An ornamental T surrounded by an ivy flourish and a returning feedback loop."
          />
          <p className="eyebrow">
            Your agent's field guide to the nuances
            <br />
            that make software marvelous
          </p>
          <h1 id="hero-title">Traits</h1>
          <InstallCommand />
          <p className="hero-description">
            From a conversation, a small insight takes root.
            <br className="desktop-break" />
            Your coding agent carries it forward.
            <em className="hero-coda">A little wiser with every generation.</em>
          </p>
          <p className="hero-byline">
            BY <a href={repository}>CROSSHATCH LABS</a>
          </p>
        </section>

        <div className="contents-band">
          <span className="eyebrow">Contents of this little volume</span>
          <a href="#lifecycle">
            <span>I.</span> From feedback to habit
          </a>
          <a href="#tools">
            <span>II.</span> A small set of instruments
          </a>
          <a href="#begin">
            <span>III.</span> Put it into practice
          </a>
        </div>

        <section className="chapter margin-blue" id="lifecycle" aria-labelledby="lifecycle-title">
          <div className="chapter-heading">
            <p className="eyebrow">Chapter I</p>
            <h2 id="lifecycle-title">From feedback to habit.</h2>
            <Flourish />
          </div>
          <div className="prose lead">
            <p>
              <span className="drop-cap">G</span>ood work is full of small corrections. Use the helper, keep the
              exception, put the imports first. Left in a conversation, those lessons are easily forgotten. A trait
              gives one useful lesson a place to live.
            </p>
            <p>
              Not a transcript. Not a giant system prompt. A concise rule, a clear scope, and just enough example to
              show what “better” looks like.
            </p>
          </div>

          <div className="walkthrough">
            <div className="walkthrough-header">
              <p className="eyebrow">Follow one correction through the lifecycle</p>
              <span className="small-note">An illustrated example, not a live tool call</span>
            </div>
            <div className="step-tabs" role="tablist" aria-label="Trait lifecycle" onKeyDown={navigateSteps}>
              {Array.map(steps, (item, index) => (
                <button
                  type="button"
                  role="tab"
                  key={item.title}
                  id={`step-${index}`}
                  aria-selected={active === index}
                  aria-controls="step-panel"
                  tabIndex={active === index ? 0 : -1}
                  onClick={() => setActive(index)}
                >
                  <span className="step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>{item.title}</span>
                </button>
              ))}
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
                    onClick={() => setActive(active - 1)}
                    aria-label="Previous lifecycle step"
                  >
                    ← Previous
                  </button>
                  {active < steps.length - 1 ? (
                    <button type="button" onClick={() => setActive(active + 1)}>
                      Next observation →
                    </button>
                  ) : (
                    <a href="#tools">Meet the instruments →</a>
                  )}
                </div>
              </div>
              <CodeSample key={active} title={step.filename} code={step.code} copyable={false} />
            </div>
          </div>
          <p className="figure-caption">
            Fig. 2 — Notice, draft, compare, approve, remember, review. Then begin again.
          </p>
          <aside className="book-note">
            <span className="eyebrow">A note in the margin</span>
            <p>
              Traits are not immutable laws. Clarify a rule when the wording is too broad. Reconcile it when a new
              preference conflicts. Keep the useful parts, ask before replacing anything, and let the next lesson
              improve the last.
            </p>
          </aside>
        </section>

        <section className="chapter margin-gold" id="tools" aria-labelledby="tools-title">
          <div className="chapter-heading">
            <p className="eyebrow">Chapter II</p>
            <h2 id="tools-title">A small set of instruments.</h2>
            <Flourish />
          </div>
          <div className="prose lead">
            <p>
              <span className="drop-cap">T</span>wo MCP tools do the practical work. One tends the collection of rules.
              The other asks whether the code lives up to them.
            </p>
          </div>
          <div className="instruments">
            <article>
              <span className="instrument-number">01 / Remember</span>
              <h3>
                <code>derive_trait</code>
              </h3>
              <p>
                Compare a proposed rule with the collection. A distinct rule can be saved; an existing rule can be
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
                Select files or glob patterns. The tool reviews current contents in 200-line chunks, compares them with
                the selected traits, and returns assessments that need attention.
              </p>
              <p className="small-note">
                Use traitIds for a focused review. Overlapping matches are deduplicated; unmatched patterns review
                nothing.
              </p>
            </article>
          </div>

          <div className="judgment">
            <span className="eyebrow">Reading an assessment</span>
            <h3>A finding is an invitation to inspect.</h3>
            <div className="verdict-grid">
              <div>
                <span className="verdict-mark good" aria-hidden="true">
                  ✓
                </span>
                <h4>Compliant</h4>
                <p>The rule applies and the supplied code follows it.</p>
              </div>
              <div>
                <span className="verdict-mark neutral" aria-hidden="true">
                  —
                </span>
                <h4>Not applicable</h4>
                <p>This excerpt does not contain behavior governed by the rule.</p>
              </div>
              <div>
                <span className="verdict-mark warning" aria-hidden="true">
                  !
                </span>
                <h4>Violation</h4>
                <p>Inspect the evidence. Fix confirmed issues and review the changed file again.</p>
              </div>
              <div>
                <span className="verdict-mark neutral" aria-hidden="true">
                  ?
                </span>
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
            <h2 id="begin-title">Put it into practice.</h2>
            <Flourish />
          </div>
          <div className="prose lead">
            <p>
              <span className="drop-cap">B</span>egin with a local collection and a coding agent. The rules remain
              readable Markdown, the choices remain yours, and the next review starts with something better than a
              half-remembered chat.
            </p>
          </div>
          <div className="setup-grid">
            <div>
              <span className="eyebrow">From this repository</span>
              <h3>Connect the local server.</h3>
              <p>
                Run the Effect-based CLI from the repository root. Configure the decision and language model layers in{" "}
                <code>traits.ts</code>, and provide the credentials those providers require.
              </p>
              <p>
                The current configuration uses TypeSafe and OpenAI. Credentials can come from the process environment or
                a discovered <code>.env</code> file. Keep them out of source control.
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
                exact rule or replacement plan.
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
              Good habits begin as small observations.
              <br />
              <em>Give the useful ones a place to grow.</em>
            </p>
            <a className="read-link" href="#top">
              Back to top ↑
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand" href="#top">
          <img className="emblem" src="/traits-mark.svg" width="48" height="48" alt="" />
          <span>TRAITS</span>
        </a>
        <p>BY CROSSHATCH LABS</p>
        <div>
          <a href={repository}>Source ↗</a>
        </div>
      </footer>
    </>
  )
}
