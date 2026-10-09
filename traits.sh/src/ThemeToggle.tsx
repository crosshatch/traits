import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Effect } from "effect"
import { Atom } from "effect/reactivity"

const darkAtom = Atom.make(false)
const initialThemeAtom = Atom.make(
  Effect.fn("ThemeToggle.initialize")(function* (ctx: Atom.AtomContext) {
    const saved = yield* Effect.try(() => localStorage.getItem("traits-theme")).pipe(
      Effect.catchTags({ UnknownError: () => Effect.succeed(null) })
    )
    const dark =
      saved === "dark" || saved === "light"
        ? saved === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches
    ctx.set(darkAtom, dark)
  })
)
const themeEffectAtom = Atom.make((ctx) => {
  const dark = ctx(darkAtom)
  return Effect.sync(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light"
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#241d28" : "#faf4e3")
  })
})

const toggleAtom = Atom.fn(
  Effect.fn("ThemeToggle.toggle")(function* (_event: unknown, ctx: Atom.FnContext) {
    const next = !ctx(darkAtom)
    ctx.set(darkAtom, next)
    yield* Effect.try(() => localStorage.setItem("traits-theme", next ? "dark" : "light")).pipe(
      Effect.catchTags({ UnknownError: () => Effect.void })
    )
  })
)

export const ThemeToggle = () => {
  useAtomMount(initialThemeAtom)
  const dark = useAtomValue(darkAtom)
  const toggle = useAtomSet(toggleAtom)
  useAtomMount(themeEffectAtom)

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="3.5" />
            <circle cx="12" cy="12" r="2" strokeWidth="0.6" />
            <path d="m12 1-1 6h2Zm0 22-1-6h2ZM1 12l6-1v2Zm22 0-6-1v2ZM4.2 4.2l3.5 2.1-1.4 1.4Zm15.6 0-2.1 3.5-1.4-1.4ZM4.2 19.8l2.1-3.5 1.4 1.4Zm15.6 0-3.5-2.1 1.4-1.4Z" />
            <path d="m8.2 2.8 1 2.5m5.6 13.4 1 2.5M2.8 8.2l2.5 1m13.4 5.6 2.5 1m-5.4-13-1 2.5M9.2 18.7l-1 2.5M2.8 15.8l2.5-1m13.4-5.6 2.5-1" />
          </>
        ) : (
          <>
            <path d="M17.5 19.5A8.5 8.5 0 0 1 10 3a9 9 0 0 0 7.5 16.5Z" />
            <path d="M7 6.5a6.5 6.5 0 0 0 1 10.7" strokeWidth="0.6" />
            <path d="m18 3 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" />
            <circle cx="21" cy="14" r="0.6" fill="currentColor" stroke="none" />
          </>
        )}
      </svg>
    </button>
  )
}
