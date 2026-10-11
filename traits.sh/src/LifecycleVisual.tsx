import type { LifecycleStep } from "./LifecycleStep.ts"

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
      <p>I’ll use the case guard. Here’s a rule we could keep for future work:</p>
      <blockquote>
        Use tagged unions’ built-in case guards when testing or filtering cases, rather than comparing <code>_tag</code>
        .
      </blockquote>
      <div className="visual-tag-row">
        <span>Specific behavior</span>
        <span>Reusable scope</span>
      </div>
      <span className="visual-footnote">Draft only · not saved yet</span>
    </div>
  ),
  compare: (
    <div className="visual-flow">
      <div className="visual-flow-node">
        <span className="visual-label">Proposed trait</span>
        <strong>Use the case guard</strong>
      </div>
      <div className="visual-connector">↓</div>
      <div className="visual-flow-node visual-flow-check">
        <strong>Compare saved traits</strong>
        <span>Coverage · scope · conflicts</span>
      </div>
      <div className="visual-flow-branches">
        <div className="visual-flow-branch">
          <span className="visual-branch-label">New preference</span>
          <span className="visual-connector">↓</span>
          <div className="visual-flow-node">
            <strong>Suggest saving</strong>
            <span>Review the draft</span>
          </div>
        </div>
        <div className="visual-flow-branch">
          <span className="visual-branch-label">Conflicting rule</span>
          <span className="visual-connector">↓</span>
          <div className="visual-flow-node">
            <strong>Reconcile</strong>
            <span>Review affected rules</span>
          </div>
        </div>
      </div>
      <div className="visual-flow-gate">Both need your approval</div>
      <span className="visual-footnote">Already covered? Reuse it. Uncertain? Don’t write.</span>
    </div>
  ),
  approve: (
    <div className="visual-card visual-dialog">
      <div className="visual-card-heading">
        Your decision <span>Nothing saved yet</span>
      </div>
      <div className="visual-dialog-body">
        <strong>Remember this preference?</strong>
        <p>Use built-in case guards when testing or filtering tagged unions.</p>
        <div className="visual-choice visual-choice-selected">
          <span className="visual-radio">●</span>
          <div>
            <strong>Approve</strong>
            <span>Save this exact rule</span>
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
            <strong>aurora_adventure_sunbeam</strong>
            <span>〈uuid〉.md · use case guards</span>
          </div>
          <span className="visual-saved-mark">✓</span>
        </div>
        <div className="visual-file">
          <span className="visual-file-icon">md</span>
          <div>
            <strong>valley_pine_island</strong>
            <span>〈uuid〉.md · prefer Effect utilities</span>
          </div>
        </div>
        <div className="visual-file">
          <span className="visual-file-icon">md</span>
          <div>
            <strong>stone_moon_otter</strong>
            <span>〈uuid〉.md · readable multiline strings</span>
          </div>
        </div>
      </div>
      <div className="visual-file-preview">
        <span className="visual-label">Saved file body</span>
        <p>Use tagged unions’ built-in case guards when testing or filtering cases…</p>
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
  draft: "The agent replies with a proposed reusable case-guard rule. It is a draft, not a saved trait.",
  compare:
    "A proposed trait is compared with saved traits. New preferences lead to a save suggestion; conflicts lead to reconciliation. Both require approval. Covered rules are reused and uncertain comparisons block writes.",
  approve:
    "An illustrative approval dialog offers Approve, Edit, and Skip. Approve is highlighted; no real trait is being saved.",
  save: "A directory of Markdown traits shows a newly saved case-guard rule alongside existing rules, with a preview of its file body.",
  review:
    "New code is cross-referenced with three traits: the manual tag comparison needs review, Array.filter follows the Effect-utilities rule, and the React-state rule does not apply.",
  correct:
    "Before and after: a manual tag-filter predicate is replaced with Outcome.guards.Fail, followed by another trait review and project checks."
}

export const LifecycleVisual = (props: { readonly step: LifecycleStep }) => (
  <figure className={`lifecycle-visual lifecycle-visual-${props.step.visual}`}>
    <div className="visual-stage" role="img" aria-label={descriptions[props.step.visual]}>
      <div aria-hidden="true">{visuals[props.step.visual]}</div>
    </div>
    <figcaption>
      <span>Field example</span> · {props.step.title}
    </figcaption>
  </figure>
)
