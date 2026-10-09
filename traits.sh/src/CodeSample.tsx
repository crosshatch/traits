import { Array, Effect, pipe, String } from "effect"
import { useState } from "react"

export interface CodeSampleProps {
  readonly title: string
  readonly code: string
}

export const CodeSample = (props: CodeSampleProps) => {
  const [status, setStatus] = useState("Copy")
  const code = String.trim(props.code)
  const copy = () => {
    Effect.promise(() => navigator.clipboard.writeText(code)).pipe(
      Effect.matchCause({
        onSuccess: () => setStatus("Copied"),
        onFailure: () => setStatus("Copy unavailable")
      }),
      Effect.andThen(Effect.sleep("2 seconds")),
      Effect.andThen(Effect.sync(() => setStatus("Copy"))),
      Effect.runFork
    )
  }

  return (
    <div className="code-sample">
      <div className="code-heading">
        <span>{props.title}</span>
        <button type="button" onClick={copy} aria-label={`Copy ${props.title}`}>
          {status}
        </button>
      </div>
      <pre>
        <code>
          {Array.map(String.split(code, "\n"), (line, index) => (
            <span className="code-line" key={index}>
              <span className="line-number" aria-hidden="true">
                {index + 1}
              </span>
              <span className={pipe(line, String.trim, String.startsWith("//")) ? "code-comment" : undefined}>
                {line !== "" ? line : " "}
              </span>
            </span>
          ))}
        </code>
      </pre>
      <span className="sr-only" role="status">
        {status === "Copy" ? "" : status}
      </span>
    </div>
  )
}
