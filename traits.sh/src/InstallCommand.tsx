import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { Effect, Schema as S, String } from "effect"
import { Atom } from "effect/reactivity"

/** The browser refused clipboard access, such as without a user gesture or permission; the button reports that copying is unavailable. */
class ClipboardWriteError extends S.TaggedError<ClipboardWriteError>()("ClipboardWriteError", { cause: S.Defect() }) {}

const statusAtom = Atom.family((_compact: boolean) => Atom.make("Paste into your coding agent"))
const copyAtom = Atom.family((compact: boolean) =>
  Atom.fn(
    Effect.fn("InstallCommand.copy")(function* (_event, ctx) {
      const text = String.stripMargin(`
      |Set up Traits in this project using
      |${window.location.origin}/SETUP.md.
      |Follow our existing package-manager and workspace conventions, ask me to choose
      |providers and models, and preserve existing configuration.
      `)
      const prompt = String.trim(text)
      const status = yield* Effect.tryPromise({
        try: () => navigator.clipboard.writeText(prompt),
        catch: (cause) => ClipboardWriteError.make({ cause })
      }).pipe(Effect.match({ onSuccess: () => "Copied", onFailure: () => "Copy unavailable" }))
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
