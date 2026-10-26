import { Array, pipe, String } from "effect"

type TraitField = {
  readonly name: string
  readonly number: string
  readonly value: string
  readonly description: string
}

const context = String.stripMargin(`
|\`\`\`diff
|-// Parse.ts
|-import { InvalidDocument } from "./InvalidDocument.ts"
|+// Parse.ts: the small error belongs to this operation.
|+export class InvalidDocument
|+  extends S.TaggedError<InvalidDocument>()("InvalidDocument", {
|+    path: S.String,
|+  }) {}
|\`\`\`
`)

const fields: ReadonlyArray<TraitField> = [
  {
    name: "name",
    number: "01",
    value: "colocate-small-domain-errors",
    description: "A minimal name with which to reference this trait from chat."
  },
  {
    name: "subject",
    number: "02",
    value: "Small domain-specific error types.",
    description: "What to look at. Identifies the thing being assessed."
  },
  {
    name: "requirement",
    number: "03",
    value:
      "Define small domain-specific error types alongside the domain operations that produce them rather than creating standalone error modules, unless separate ownership or dependency constraints justify a separate module.",
    description: "What should be true about the subject. The authoritative criterion."
  },
  {
    name: "purpose",
    number: "04",
    value: "Keep small error definitions close to their meaning and avoid unnecessary module fragmentation.",
    description: "The reason behind it. What the preference aims to protect."
  },
  {
    name: "context",
    number: "05",
    value: String.trim(context),
    description: "Any additional context with which the agent should interpret the current trait."
  }
]

const TraitFieldRow = (props: { readonly field: TraitField }) => {
  const { field } = props
  return (
    <>
      {field.name === "context" && (
        <pre className="anatomy-delimiter">
          <code>---</code>
        </pre>
      )}
      <div className="anatomy-row" data-field={field.name}>
        <span className="anatomy-marker" aria-hidden="true">
          {field.number}
        </span>
        <div className="anatomy-field-content">
          <pre className="anatomy-example" id={`anatomy-field-${field.name}`}>
            <code>
              {field.name !== "context" && <span className="anatomy-key">{field.name}: </span>}
              {field.name === "context"
                ? Array.map(String.split(field.value, "\n"), (line, index) => (
                    <span
                      className="anatomy-diff-line"
                      data-change={
                        pipe(line, String.startsWith("+"))
                          ? "added"
                          : pipe(line, String.startsWith("-")) && line !== "---"
                            ? "removed"
                            : "context"
                      }
                      key={line}
                    >
                      {index > 0 && "\n"}
                      {line}
                    </span>
                  ))
                : field.value}
            </code>
          </pre>
          <p className="anatomy-field-description">{field.description}</p>
        </div>
      </div>
    </>
  )
}

export const TraitAnatomy = () => (
  <section className="chapter margin-green trait-anatomy" id="anatomy" aria-labelledby="anatomy-title">
    <div className="chapter-heading">
      <p className="eyebrow">Chapter I</p>
      <h2 id="anatomy-title">Anatomy of a Trait</h2>
    </div>
    <div className="prose lead">
      <p>
        <span className="drop-cap">A</span> trait is a reusable preference your agent learns from your feedback. It
        describes what matters to you and gives future work context that takes judgment to apply.
      </p>
    </div>
    <figure className="anatomy-feedback">
      <figcaption className="eyebrow">It starts with your feedback</figcaption>
      <blockquote>
        “Keep small errors beside the operations that produce them, unless ownership or dependencies justify separating
        them.”
      </blockquote>
    </figure>
    <div className="anatomy-specimen">
      <div
        className="anatomy-diagram"
        aria-label="A complete trait with explanations alongside each of its five fields"
      >
        <div className="anatomy-filename">
          <span className="anatomy-document-label">A TRAIT, IN FULL</span>
          <code>.agents/traits/colocate-small-domain-errors.md</code>
        </div>
        <pre className="anatomy-delimiter">
          <code>---</code>
        </pre>
        {Array.map(fields, (field) => (
          <TraitFieldRow key={field.name} {...{ field }} />
        ))}
      </div>
    </div>
    <p className="anatomy-payoff">
      One correction. <span aria-hidden="true">→</span>{" "}
      <em>A preference your agent can carry into every future task.</em>
    </p>
  </section>
)
