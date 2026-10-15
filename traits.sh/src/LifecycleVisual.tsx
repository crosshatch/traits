import { Array } from "effect"

import { steps, type LifecycleStep } from "./LifecycleStep.ts"

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
  draft: (
    <div className="visual-chat visual-chat-agent">
      <span className="visual-label">Agent · chat output</span>
      <p>I’ll use the case guard. Shall we keep this preference?</p>
      <blockquote>{caseGuardTrait}</blockquote>
      <div className="visual-tag-row">
        <span>Specific behavior</span>
        <span>Reusable scope</span>
      </div>
      <span className="visual-footnote">Draft only · not saved yet</span>
    </div>
  ),
  compare: (
    <div className="visual-stack">
      <div className="visual-card visual-chat">
        <span className="visual-label">Existing preference</span>
        <p>Compare _tag when filtering tagged unions. Keep filters concise.</p>
      </div>
      <div className="visual-improvement-arrow">
        ↓ <span>Update the approach. Keep the useful part.</span>
      </div>
      <div className="visual-chat visual-chat-agent">
        <span className="visual-label">Proposed reconciliation</span>
        <blockquote>{caseGuardTrait} Keep filters concise.</blockquote>
        <span className="visual-footnote">A proposal for your review · nothing replaced yet</span>
      </div>
    </div>
  ),
  approve: (
    <div className="visual-card visual-dialog">
      <div className="visual-card-heading">
        Your decision <span>Nothing saved yet</span>
      </div>
      <div className="visual-dialog-body">
        <strong>Remember this preference?</strong>
        <p>{caseGuardTrait} Keep filters concise.</p>
        <div className="visual-choice visual-choice-selected">
          <span className="visual-radio">●</span>
          <div>
            <strong>Approve</strong>
            <span>Save this exact trait</span>
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
  save: (
    <div className="visual-card visual-files">
      <div className="visual-card-heading">
        Your checkout <span>Readable. Versionable.</span>
      </div>
      <div className="visual-file-tree">
        <div className="visual-folder">
          ▾ <strong>.agents/</strong>
        </div>
        <div className="visual-folder visual-tree-indent">
          ▾ <strong>traits/</strong>
        </div>
        <div className="visual-file visual-file-new">
          <span className="visual-file-icon">md</span>
          <div>
            <strong>tagged_union_case_guards</strong>
            <span>-〈uuid〉.md · Use case guards</span>
          </div>
          <span className="visual-saved-mark">✓</span>
        </div>
        <div className="visual-file">
          <span className="visual-file-icon">md</span>
          <div>
            <strong>effect_utilities_with_native_behavior_exceptions</strong>
            <span>-〈uuid〉.md · Prefer Effect utilities</span>
          </div>
        </div>
        <div className="visual-file">
          <span className="visual-file-icon">md</span>
          <div>
            <strong>strip_margin_for_multiline_text</strong>
            <span>-〈uuid〉.md · Readable multiline strings</span>
          </div>
        </div>
      </div>
      <div className="visual-file-preview">
        <span className="visual-label">Saved file body</span>
        <p>{caseGuardTrait} Keep filters concise.</p>
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
  draft: "The agent replies with a proposed reusable case-guard trait. It is a draft, not a saved trait.",
  compare:
    "An existing preference to compare tags conflicts with the new case-guard trait. A proposed reconciliation uses case guards while preserving the preference for concise filters. Nothing is replaced without approval.",
  approve:
    "An illustrative approval dialog offers Approve, Edit, and Skip. Approve is highlighted; no real trait is being saved.",
  save: "A directory of Markdown traits shows a newly saved case-guard trait alongside existing traits, with a preview of its file body.",
  review:
    "New code is cross-referenced with three traits: the manual tag comparison needs review, Array.filter follows the Effect-utilities trait, and the React-state trait does not apply.",
  correct:
    "Before and after: a manual tag-filter predicate is replaced with Outcome.guards.Fail, followed by another trait review and project checks."
}

export const LifecycleVisual = (props: { readonly step: LifecycleStep; readonly index: number }) => (
  <figure className={`lifecycle-visual lifecycle-visual-${props.step.visual}`}>
    <div className="visual-story-heading" aria-hidden="true">
      <span className="visual-label">One correction, carried forward</span>
      <strong>Use the case guard</strong>
      <div className="visual-story-progress">
        {Array.map(steps, (step, index) => (
          <span key={step.visual} className={index <= props.index ? "is-reached" : undefined} />
        ))}
      </div>
    </div>
    <div className="visual-stage" role="img" aria-label={descriptions[props.step.visual]}>
      <div aria-hidden="true">{visuals[props.step.visual]}</div>
    </div>
    <figcaption>
      <span>Field example</span> · {props.step.title}
    </figcaption>
  </figure>
)
