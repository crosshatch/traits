import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Effect } from "effect"
import { Atom } from "effect/reactivity"

const commandAtoms = Atom.family((_compact: boolean) => {
  const statusAtom = Atom.make("Click to copy")
  const copyAtom = Atom.fn(
    Effect.fn("InstallCommand.copy")(function* (_event: unknown, ctx: Atom.FnContext) {
      const status = yield* Effect.promise(() => navigator.clipboard.writeText("npx traits init")).pipe(
        Effect.matchCause({ onSuccess: () => "Copied", onFailure: () => "Copy unavailable" })
      )
      ctx.set(statusAtom, status)
      yield* Effect.sleep("2 seconds")
      ctx.set(statusAtom, "Click to copy")
    })
  )
  return { statusAtom, copyAtom }
})

export const InstallCommand = (props: { readonly compact?: boolean | undefined }) => {
  const atoms = commandAtoms(props.compact === true)
  const status = useAtomValue(atoms.statusAtom)
  const copy = useAtomSet(atoms.copyAtom)

  return (
    <button
      type="button"
      className={props.compact === true ? "install-command compact-install-command" : "install-command"}
      onClick={copy}
      aria-label="Copy npx traits init"
    >
      {props.compact !== true && (
        <svg className="ivy-frame" viewBox="0 0 340 110" aria-hidden="true" fill="none">
          <defs>
            <g id="command-frame-scroll" stroke="var(--muted)" strokeOpacity=".6" strokeWidth=".8">
              <path d="M0 0C4-4 12-4 14 0S6 4 7 0s5-2 4 0M14 0c4 4 12 4 14 0S20-4 21 0s5 2 4 0" />
            </g>
            <path id="command-ivy-outline" d="M30 27H310V85H30Z" />
          </defs>
          <use
            href="#command-ivy-outline"
            stroke="var(--gold)"
            strokeOpacity=".5"
            strokeWidth="17"
            strokeLinejoin="miter"
          />
          <use
            href="#command-ivy-outline"
            stroke="color-mix(in srgb, var(--paper), var(--blue) 18%)"
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
            fill="var(--gold)"
            fillOpacity=".6"
            stroke="none"
          />
          <use className="ivy-stem" href="#command-ivy-outline" />
        </svg>
      )}
      <code>npx traits init</code>
      <span className="install-status" role="status">
        {status}
      </span>
    </button>
  )
}
