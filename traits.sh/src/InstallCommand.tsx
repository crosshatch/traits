import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Effect } from "effect"
import { Atom } from "effect/reactivity"

import { setupPrompt } from "./SetupPrompt.ts"

const statusAtom = Atom.family((_compact: boolean) => Atom.make("Paste into your coding agent"))
const copyAtom = Atom.family((compact: boolean) =>
  Atom.fn(
    Effect.fn("InstallCommand.copy")(function* (_event, ctx) {
      const prompt = setupPrompt(new URL("/SETUP.md", window.location.href).href)
      const status = yield* Effect.promise(() => navigator.clipboard.writeText(prompt)).pipe(
        Effect.matchCause({ onSuccess: () => "Copied", onFailure: () => "Copy unavailable" })
      )
      ctx.set(statusAtom(compact), status)
      yield* Effect.sleep("2 seconds")
      ctx.set(statusAtom(compact), "Paste into your coding agent")
    })
  )
)

export const InstallCommand = (props: { readonly compact?: boolean | undefined }) => {
  const compact = props.compact === true
  const status = useAtomValue(statusAtom(compact))
  const copy = useAtomSet(copyAtom(compact))

  return (
    <button
      type="button"
      className={props.compact === true ? "install-command compact-install-command" : "install-command"}
      onClick={copy}
      aria-label={status === "Paste into your coding agent" ? "Copy Traits setup prompt for your coding agent" : status}
    >
      {props.compact !== true && (
        <svg className="command-frame" viewBox="0 0 320 104" preserveAspectRatio="none" aria-hidden="true" fill="none">
          <rect x="1" y="1" width="318" height="102" />
          <rect x="5" y="5" width="310" height="94" />
          <path d="M1 13h12V1m294 0v12h12M1 91h12v12m294 0V91h12" />
        </svg>
      )}
      <code>{status === "Paste into your coding agent" ? "COPY SETUP PROMPT" : status}</code>
      <span className="install-status">Paste into your agent</span>
      <span className="sr-only" role="status">
        {status !== "Paste into your coding agent" && status}
      </span>
    </button>
  )
}
