type TraitField = {
  readonly name: string
  readonly number: string
  readonly value: string
  readonly description: string
}

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
    value: `---

\`\`\`diff
-// Parse.ts
-import { InvalidDocument } from "./InvalidDocument.ts"
+// Parse.ts: the small error belongs to this operation.
+export class InvalidDocument
+  extends S.TaggedError<InvalidDocument>()("InvalidDocument", {
+    path: S.String,
+  }) {}
\`\`\``,
    description: "Any additional context with which the agent should interpret the current trait."
  }
]

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
    <div className="anatomy-diagram" aria-label="A complete trait with explanations of its five parts">
      <div className="anatomy-filename">
        <code>.agents/traits/colocate-small-domain-errors.md</code>
      </div>
      {fields.map((field) => (
        <div className="anatomy-row" data-field={field.name} key={field.name}>
          <pre className="anatomy-example">
            <code>
              {field.name === "name" && <span className="anatomy-fence">{"---\n"}</span>}
              {field.name !== "context" && <span className="anatomy-key">{field.name}: </span>}
              {field.name === "context"
                ? field.value.split("\n").map((line, index) => (
                    <span
                      className="anatomy-diff-line"
                      data-change={
                        line.startsWith("+") ? "added" : line.startsWith("-") && line !== "---" ? "removed" : "context"
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
          <div className="anatomy-description">
            <h3>
              <span>{field.number} · </span>
              {field.name}
            </h3>
            <p>{field.description}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
)
