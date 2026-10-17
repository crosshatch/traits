import { Array, pipe, String } from "effect"

// Every catalog page: "/" focuses the sidebar's search field, which submits to /traits/?q=….
const form = document.querySelector<HTMLFormElement>("[data-catalog-search]")!
const input = form.querySelector("input")!
document.addEventListener("keydown", (event) => {
  const target = event.target
  if (
    event.key === "/" &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !(
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    )
  ) {
    event.preventDefault()
    input.focus()
  }
})

// The catalog index: filter the list in place from the search field and the sidebar's facets,
// keeping the state in the URL (?q=, ?mime=, ?source=) so the facets on trait pages can link to it.
const status = document.querySelector("[data-catalog-status]")
if (status !== null) {
  const clear = document.querySelector<HTMLElement>("[data-catalog-clear]")!
  const sources = Array.fromIterable(document.querySelectorAll<HTMLElement>("[data-catalog-source]"))
  const items = Array.fromIterable(document.querySelectorAll<HTMLElement>("[data-trait]"))
  const facets = Array.fromIterable(document.querySelectorAll<HTMLAnchorElement>(".sidenav a"))
  const navigation = document.querySelector<HTMLElement>(".sidenav")!

  const apply = () => {
    const params = new URL(location.href).searchParams
    const mime = params.get("mime")
    const source = params.get("source")
    const terms = pipe(input.value, String.toLowerCase, String.split(/\s+/), Array.filter(String.isNonEmpty))
    Array.forEach(items, (item) => {
      item.hidden = !(
        Array.every(terms, (term) => pipe(item.dataset.trait ?? "", String.includes(term))) &&
        (mime === null || pipe(item.dataset.mime ?? "", String.split(" "), Array.contains(mime))) &&
        (source === null || item.dataset.source === source)
      )
    })
    Array.forEach(sources, (section) => {
      section.hidden = Array.every(
        Array.fromIterable(section.querySelectorAll<HTMLElement>("[data-trait]")),
        (item) => item.hidden === true
      )
    })
    Array.forEach(facets, (facet) => {
      const facetParams = new URL(facet.href).searchParams
      const facetMime = facetParams.get("mime")
      const facetSource = facetParams.get("source")
      const current =
        facetMime !== null
          ? facetMime === mime
          : facetSource !== null
            ? facetSource === source
            : mime === null && source === null
      if (current) facet.setAttribute("aria-current", facetMime === null && facetSource === null ? "page" : "true")
      else facet.removeAttribute("aria-current")
    })
    const shown = Array.countBy(items, (item) => item.hidden !== true)
    const filtered = shown !== items.length
    status.textContent = !filtered
      ? ""
      : shown === 0
        ? "No traits match."
        : `Showing ${shown} of ${items.length} traits.`
    clear.hidden = !filtered
  }

  const navigate = (url: URL) => {
    history.pushState(null, "", url)
    apply()
  }

  input.value = new URL(location.href).searchParams.get("q") ?? ""
  input.addEventListener("input", () => {
    const url = new URL(location.href)
    if (String.isNonEmpty(input.value)) url.searchParams.set("q", input.value)
    else url.searchParams.delete("q")
    history.replaceState(null, "", url)
    apply()
  })
  form.addEventListener("submit", (event) => event.preventDefault())
  Array.forEach(facets, (facet) =>
    facet.addEventListener("click", (event) => {
      event.preventDefault()
      const url = new URL(location.href)
      const facetParams = new URL(facet.href).searchParams
      if (facetParams.size === 0) {
        input.value = ""
        url.search = ""
      }
      facetParams.forEach((value, name) => url.searchParams.set(name, value))
      navigation.hidePopover()
      navigate(url)
    })
  )
  clear.addEventListener("click", (event) => {
    event.preventDefault()
    input.value = ""
    const url = new URL(location.href)
    url.search = ""
    navigate(url)
  })
  window.addEventListener("popstate", () => {
    input.value = new URL(location.href).searchParams.get("q") ?? ""
    apply()
  })
  apply()
}
