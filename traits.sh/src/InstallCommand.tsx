import { Effect } from "effect"
import { useState } from "react"

export const InstallCommand = () => {
  const [status, setStatus] = useState("Click to copy")
  const copy = () => {
    Effect.promise(() => navigator.clipboard.writeText("npx traits init")).pipe(
      Effect.matchCause({
        onSuccess: () => setStatus("Copied"),
        onFailure: () => setStatus("Copy unavailable")
      }),
      Effect.andThen(Effect.sleep("2 seconds")),
      Effect.andThen(Effect.sync(() => setStatus("Click to copy"))),
      Effect.runFork
    )
  }

  return (
    <button type="button" className="install-command" onClick={copy} aria-label="Copy npx traits init">
      <svg className="ivy-frame" viewBox="0 0 300 76" aria-hidden="true" fill="none">
        <path d="M16 38C10 17 26 9 47 12S100 8 150 12s84-3 107 0 37 7 27 26c10 21-6 29-27 26s-53 4-107 0-84 3-107 0S6 59 16 38Z" />
        <path
          d="M35 12C22 1 16 8 21 18c5 6 12 1 14-6Zm26 0C50 24 39 22 42 13c2-7 13-5 19-1Zm48-1C99 0 89 2 91 10c2 8 13 6 18 1Zm88 1c10-12 20-9 18-1-2 8-13 7-18 1Zm47 0c10 12 21 10 18 1-2-7-13-5-18-1Zm26 1c13-11 19-4 14 6-5 6-12 1-14-6ZM30 64c-13 11-19 4-14-6 5-6 12-1 14 6Zm31 0c-11-12-22-10-19-1 2 7 13 5 19 1Zm48 1c-10 11-20 9-18 1 2-8 13-6 18-1Zm88-1c10 12 20 9 18 1-2-8-13-7-18-1Zm47 0c10-12 21-10 18-1-2 7-13 5-18 1Zm26-1c13 11 19 4 14-6-5-6-12-1-14 6Z"
          className="ivy-leaves"
        />
      </svg>
      <code>npx traits init</code>
      <span className="install-status" role="status">
        {status}
      </span>
    </button>
  )
}
