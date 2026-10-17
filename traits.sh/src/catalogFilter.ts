import { Array, pipe, String } from "effect"

const form = document.querySelector<HTMLElement>("[data-catalog-filter]")
if (form !== null) {
  const input = form.querySelector("input")!
  const status = form.querySelector("[data-catalog-status]")!
  const tags = Array.fromIterable(form.querySelectorAll<HTMLButtonElement>("button[data-mime]"))
  const sources = Array.fromIterable(document.querySelectorAll<HTMLElement>("[data-catalog-source]"))
  const items = Array.fromIterable(document.querySelectorAll<HTMLElement>("[data-trait]"))

  const apply = () => {
    const terms = pipe(input.value, String.toLowerCase, String.split(/\s+/), Array.filter(String.isNonEmpty))
    const mimes = pipe(
      tags,
      Array.filter((tag) => tag.getAttribute("aria-pressed") === "true"),
      Array.map((tag) => tag.dataset.mime ?? "")
    )
    Array.forEach(items, (item) => {
      const text = item.dataset.trait ?? ""
      const types = pipe(item.dataset.mime ?? "", String.split(" "))
      item.hidden = !(
        Array.every(terms, (term) => pipe(text, String.includes(term))) &&
        (Array.isReadonlyArrayEmpty(mimes) || Array.some(mimes, (mime) => Array.contains(types, mime)))
      )
    })
    Array.forEach(sources, (source) => {
      source.hidden = Array.every(
        Array.fromIterable(source.querySelectorAll<HTMLElement>("[data-trait]")),
        (item) => item.hidden === true
      )
    })
    const shown = Array.filter(items, (item) => item.hidden !== true).length
    status.textContent =
      shown === items.length ? "" : shown === 0 ? "No traits match." : `Showing ${shown} of ${items.length} traits.`
  }

  input.addEventListener("input", apply)
  Array.forEach(tags, (tag) =>
    tag.addEventListener("click", () => {
      tag.setAttribute("aria-pressed", tag.getAttribute("aria-pressed") === "true" ? "false" : "true")
      apply()
    })
  )
  document.addEventListener("keydown", (event) => {
    const target = event.target
    if (
      event.key === "/" &&
      !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault()
      input.focus()
    }
  })
  form.hidden = false
  apply()
}
