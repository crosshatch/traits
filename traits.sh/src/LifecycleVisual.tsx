import type { LifecycleStep } from "./LifecycleStep.ts"

const caseGuardTrait = "Use built-in case guards when testing or filtering tagged unions."

const visuals = {
  feedback: (
    <div className="visual-stack">
      <div className="visual-chat visual-chat-user">
        <span className="visual-label">You · chat input</span>
        <p>Use the union’s case guard here, rather than comparing the tag yourself.</p>
        <span className="visual-send">↑</span>
      </div>
      <div className="visual-card visual-diff">
        <div className="visual-card-heading">
          src/Outcome.ts <span>Small correction</span>
        </div>
        <div className="visual-line visual-line-removed">
          <span>−</span>
          <code>value._tag === "Fail"</code>
        </div>
        <div className="visual-line visual-line-added">
          <span>+</span>
          <code>Outcome.guards.Fail(value)</code>
        </div>
      </div>
    </div>
  ),
  remember: (
    <div className="visual-card visual-dialog">
      <div className="visual-card-heading">
        Your decision <span>Nothing saved yet</span>
      </div>
      <div className="visual-dialog-body">
        <strong>Remember this preference?</strong>
        <p>{caseGuardTrait}</p>
        <span className="visual-footnote">Conflicts? Review the proposed changes before approving.</span>
        <div className="visual-choice visual-choice-selected">
          <span className="visual-radio">●</span>
          <div>
            <strong>Approve</strong>
            <span>Save as project Markdown for future sessions</span>
          </div>
          <span>↵</span>
        </div>
        <div className="visual-choice">
          <span className="visual-radio">○</span>
          <div>
            <strong>Edit</strong>
            <span>Change the wording or scope</span>
          </div>
        </div>
        <div className="visual-choice">
          <span className="visual-radio">○</span>
          <div>
            <strong>Skip</strong>
            <span>Leave the collection unchanged</span>
          </div>
        </div>
      </div>
    </div>
  ),
  review: (
    <div className="visual-stack">
      <div className="visual-card visual-snippet">
        <div className="visual-card-heading">
          New code <span>src/Outcome.ts</span>
        </div>
        <code>
          Array.filter(outcomes, (value) =&gt;
          <br />
          <mark>value._tag === "Fail"</mark>)
        </code>
      </div>
      <div className="visual-review-connection">
        ↓ <span>Cross-reference saved traits</span> ↓
      </div>
      <div className="visual-trait-checks">
        <div className="visual-trait-check visual-trait-violation">
          <span>!</span>
          <div>
            <strong>Use case guards</strong>
            <span>Inspect this comparison</span>
          </div>
          <span>Review</span>
        </div>
        <div className="visual-trait-check">
          <span>✓</span>
          <div>
            <strong>Prefer Effect utilities</strong>
            <span>Uses Array.filter</span>
          </div>
          <span>Compliant</span>
        </div>
        <div className="visual-trait-check">
          <span>—</span>
          <div>
            <strong>Use atoms for React state</strong>
            <span>No React state in this snippet</span>
          </div>
          <span>Not applicable</span>
        </div>
      </div>
      <span className="visual-footnote">The model flags it. The agent checks the evidence.</span>
    </div>
  ),
  correct: (
    <div className="visual-stack">
      <div className="visual-before">
        <span className="visual-label">Before · manual tag check</span>
        <code>
          Array.filter(outcomes, (value) =&gt;
          <br />
          value._tag === "Fail")
        </code>
      </div>
      <div className="visual-improvement-arrow">
        ↓ <span>Replace the predicate with the guard</span>
      </div>
      <div className="visual-after">
        <div className="visual-label">
          After · use the union’s guard <span>✓</span>
        </div>
        <code>
          Array.filter(outcomes,
          <br />
          <strong>Outcome.guards.Fail</strong>)
        </code>
        <div className="visual-tag-row">
          <span>No manual tag comparison</span>
          <span>Built-in case guard</span>
        </div>
      </div>
      <div className="visual-recheck">
        <span className="visual-recheck-seal">✓</span>
        <div>
          <strong>Corrected. Checked again.</strong>
          <span>Rerun trait review and project checks.</span>
        </div>
      </div>
    </div>
  )
}

const descriptions = {
  feedback: "A user’s chat correction replaces a manual _tag comparison with Outcome.guards.Fail in a code diff.",
  remember:
    "An illustrative dialog proposes a case-guard trait and offers Approve, Edit, and Skip. Conflicting changes require review; approved traits are saved as project Markdown for future sessions. No real trait is being saved.",
  review:
    "New code is cross-referenced with three traits: the manual tag comparison needs review, Array.filter follows the Effect-utilities trait, and the React-state trait does not apply.",
  correct:
    "Before and after: a manual tag-filter predicate is replaced with Outcome.guards.Fail, followed by another trait review and project checks."
}

export const LifecycleVisual = (props: { readonly step: LifecycleStep; readonly index: number }) => (
  <figure className={`lifecycle-visual lifecycle-visual-${props.step.visual}`}>
    <figcaption>
      <span>{props.step.title}</span>
    </figcaption>
    <div className="visual-stage" role="img" aria-label={descriptions[props.step.visual]}>
      <div aria-hidden="true">{visuals[props.step.visual]}</div>
    </div>
  </figure>
)
