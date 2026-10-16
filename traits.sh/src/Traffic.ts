/**
 * Counts page views, setup-prompt copies and GitHub clicks for the traction
 * dashboard. Posts link here through /go/<slug>, which adds ?ref=<slug>; the
 * ref and landing referrer are kept for the browser session so later actions
 * are credited to the post. No cookies or identifiers are sent. Tracking is
 * off unless the build sets VITE_SITE_EVENTS_URL.
 */
import { Effect, Equal, pipe, Predicate, Schema as S, String } from "effect"
import { Atom } from "effect/reactivity"

export type SiteEvent = typeof SiteEvent.Type
export const SiteEvent = S.Literals(["view", "copy_prompt", "github_click", "setup_click"])

export interface SiteAction {
  readonly event: SiteEvent
  /** Where on the page, e.g. hero or footer. */
  readonly placement?: string | undefined
}

type Visit = typeof Visit.Type
const Visit = S.Struct({ ref: S.String.pipe(S.optional), referrer: S.String.pipe(S.optional) })

const endpoint: string | undefined = import.meta.env.VITE_SITE_EVENTS_URL
const visitKey = "traits.visit"

const send = Effect.fn("Traffic.send")(function* (action: SiteAction, visit: Visit) {
  if (Predicate.isUndefined(endpoint) || String.isEmpty(endpoint)) return
  const body = yield* pipe(
    { ...action, ...visit },
    S.encodeEffect(
      S.fromJsonString(S.Struct({ ...Visit.fields, event: SiteEvent, placement: S.String.pipe(S.optional) }))
    ),
    Effect.orDie
  )
  // text/plain keeps the beacon a simple request, so no CORS preflight is needed.
  yield* Effect.sync(() => navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain" })))
})

/** The session's visit, started or continued on load. Counts the page view and removes ?ref= from the address bar. */
export const visitAtom = Atom.make(
  Effect.gen(function* () {
    const url = new URL(location.href)
    const ref = url.searchParams.get("ref") ?? undefined
    const referrer = String.isEmpty(document.referrer) ? undefined : document.referrer
    const external = Predicate.isNotUndefined(referrer) && !Equal.equals(new URL(referrer).host, location.host)
    // Storage can be unavailable (private modes) or hold an unreadable value; the visit then lasts only for this page.
    const stored = yield* Effect.try(() => sessionStorage.getItem(visitKey)).pipe(
      Effect.flatMap((json) =>
        Predicate.isNull(json) ? Effect.undefined : pipe(json, S.decodeEffect(S.fromJsonString(Visit)))
      ),
      Effect.catchTags({ UnknownError: () => Effect.undefined, SchemaError: () => Effect.undefined })
    )
    // A new ref or an arrival from another site starts a new visit. Reloads keep their referrer but lose ?ref=, so they
    // continue the stored visit, as does in-site navigation.
    const visit: Visit =
      Predicate.isNotUndefined(ref) ||
      Predicate.isUndefined(stored) ||
      (external && !Equal.equals(referrer, stored.referrer))
        ? { ref, referrer }
        : stored
    yield* pipe(
      visit,
      S.encodeEffect(S.fromJsonString(Visit)),
      Effect.orDie,
      Effect.flatMap((json) => Effect.try(() => sessionStorage.setItem(visitKey, json))),
      Effect.catchTags({ UnknownError: () => Effect.void })
    )
    if (Predicate.isNotUndefined(ref)) {
      url.searchParams.delete("ref")
      history.replaceState(history.state, "", url)
    }
    yield* send({ event: "view" }, visit)
    return visit
  })
).pipe(Atom.keepAlive)

/** Counts an action, credited to the session's visit. */
export const track = Effect.fn("Traffic.track")(function* (action: SiteAction, ctx: Atom.FnContext) {
  yield* ctx.result(visitAtom).pipe(Effect.flatMap((visit) => send(action, visit)))
})

export const trackAtom = Atom.fn(track)
