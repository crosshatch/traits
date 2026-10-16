import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Array, Data, Effect, pipe, Predicate, String } from "effect"
import { Atom } from "effect/reactivity"
import { useId } from "react"

import { track } from "./Traffic.ts"

const statusAtom = Atom.family((_id: string) => Atom.make("Copy"))
class CopyInput extends Data.Class<{
  readonly id: string
  readonly code: string
  readonly copyPlacement: string | undefined
}> {}
const copyAtom = Atom.family((params: CopyInput) =>
  Atom.fn(
    Effect.fn("CodeSample.copy")(function* (_event: unknown, ctx: Atom.FnContext) {
      const status = yield* Effect.promise(() => navigator.clipboard.writeText(params.code)).pipe(
        Effect.tap(() =>
          Predicate.isUndefined(params.copyPlacement)
            ? Effect.void
            : track({ event: "copy_prompt", placement: params.copyPlacement }, ctx)
        ),
        Effect.matchCause({ onSuccess: () => "Copied", onFailure: () => "Copy unavailable" })
      )
      ctx.set(statusAtom(params.id), status)
      yield* Effect.sleep("2 seconds")
      ctx.set(statusAtom(params.id), "Copy")
    })
  )
)

export interface CodeSampleProps {
  readonly title: string
  readonly code: string
  readonly copyable?: boolean | undefined
  /** Counts copies as setup-prompt copies from this placement on the page. */
  readonly copyPlacement?: string | undefined
}

const renderLine = (line: string, index: number) => (
  <span className="code-line" key={index}>
    <span className="line-number" aria-hidden="true">
      {index + 1}
    </span>
    <span className={pipe(line, String.trim, String.startsWith("//")) ? "code-comment" : undefined}>{line}</span>
  </span>
)

export const CodeSample = (props: CodeSampleProps) => {
  const id = useId()
  const status = useAtomValue(statusAtom(id))
  const code = String.trim(props.code)
  const copy = useAtomSet(copyAtom(new CopyInput({ id, code, copyPlacement: props.copyPlacement })))

  return (
    <div className="code-sample">
      <div className="code-heading">
        <span>{props.title}</span>
        {props.copyable !== false && (
          <button type="button" onClick={copy} aria-label={`Copy ${props.title}`}>
            {status}
          </button>
        )}
      </div>
      <pre>
        <code>{Array.map(String.split(code, "\n"), renderLine)}</code>
      </pre>
      <span className="sr-only" role="status">
        {status !== "Copy" && status}
      </span>
    </div>
  )
}
