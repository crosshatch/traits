import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Effect } from "effect"
import { Atom } from "effect/reactivity"

import { setupPrompt } from "./SetupPrompt.ts"

const statusAtom = Atom.family((_compact: boolean) => Atom.make("Paste into your coding agent"))
const copyAtom = Atom.family((compact: boolean) =>
  Atom.fn(
    Effect.fn("InstallCommand.copy")(function* (_event: unknown, ctx: Atom.FnContext) {
      const status = yield* Effect.promise(() => navigator.clipboard.writeText(setupPrompt)).pipe(
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
        <svg className="ivy-frame" viewBox="0 0 340 110" aria-hidden="true" fill="none">
          <defs>
            <g id="command-frame-scroll" stroke="var(--ink-muted)" strokeOpacity=".6" strokeWidth=".8">
              <path d="M0 0C4-4 12-4 14 0S6 4 7 0s5-2 4 0M14 0c4 4 12 4 14 0S20-4 21 0s5 2 4 0" />
            </g>
            <path id="command-ivy-outline" d="M30 27H310V85H30Z" />
          </defs>
          <use
            href="#command-ivy-outline"
            stroke="var(--gilt)"
            strokeOpacity=".5"
            strokeWidth="17"
            strokeLinejoin="miter"
          />
          <use
            href="#command-ivy-outline"
            stroke="color-mix(in srgb, var(--surface), var(--lapis) 18%)"
            strokeWidth="15"
            strokeLinejoin="miter"
          />
          <g>
            <use href="#command-frame-scroll" transform="translate(42 23)" />
            <use href="#command-frame-scroll" transform="translate(74 23)" />
            <use href="#command-frame-scroll" transform="translate(106 23)" />
            <use href="#command-frame-scroll" transform="translate(138 23)" />
            <use href="#command-frame-scroll" transform="translate(174 23)" />
            <use href="#command-frame-scroll" transform="translate(206 23)" />
            <use href="#command-frame-scroll" transform="translate(238 23)" />
            <use href="#command-frame-scroll" transform="translate(270 23)" />
            <use href="#command-frame-scroll" transform="translate(42 89)" />
            <use href="#command-frame-scroll" transform="translate(74 89)" />
            <use href="#command-frame-scroll" transform="translate(106 89)" />
            <use href="#command-frame-scroll" transform="translate(138 89)" />
            <use href="#command-frame-scroll" transform="translate(174 89)" />
            <use href="#command-frame-scroll" transform="translate(206 89)" />
            <use href="#command-frame-scroll" transform="translate(238 89)" />
            <use href="#command-frame-scroll" transform="translate(270 89)" />
            <use href="#command-frame-scroll" transform="translate(26 41) rotate(90)" />
            <use href="#command-frame-scroll" transform="translate(314 41) rotate(90)" />
          </g>
          <path
            d="m25 22 5-3 5 3-5 3Zm280 0 5-3 5 3-5 3ZM25 90l5-3 5 3-5 3Zm280 0 5-3 5 3-5 3Z"
            fill="var(--gilt)"
            fillOpacity=".6"
            stroke="none"
          />
          <use className="ivy-stem" href="#command-ivy-outline" />
        </svg>
      )}
      <code>{status === "Paste into your coding agent" ? "Copy setup prompt" : status}</code>
      <span className="install-status">Paste into your coding agent</span>
      <span className="sr-only" role="status">
        {status !== "Paste into your coding agent" && status}
      </span>
    </button>
  )
}
