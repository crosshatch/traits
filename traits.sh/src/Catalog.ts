import type { CollectionEntry } from "astro:content"
import { Array, Order, pipe, Record, String } from "effect"

import { mimeLabel } from "./mimeLabel.ts"

export type Entry = CollectionEntry<"traits">

export interface NavigationItem {
  readonly label: string
  readonly href: string
  readonly current?: boolean | undefined
  /** Number of traits behind a catalog facet. */
  readonly count?: number | undefined
  /** Sets the label in mono, for identifiers such as trait names. */
  readonly code?: boolean | undefined
}

export interface NavigationGroup {
  readonly title: string
  readonly items: ReadonlyArray<NavigationItem>
}

export const href = (entry: Entry) => `/traits/${entry.id}/`

export interface Source {
  /** The `owner/repo` slug. */
  readonly repository: string
  readonly entries: ReadonlyArray<Entry>
}

/** Traits grouped by repository, both sorted by name. */
export const sources = (traits: ReadonlyArray<Entry>) =>
  pipe(
    traits,
    Array.sortWith((entry) => entry.data.name, Order.String),
    Array.groupBy((entry) => `${entry.data.owner}/${entry.data.repo}`),
    Record.collect((repository, entries): Source => ({ repository, entries })),
    Array.sortWith((source) => source.repository, Order.String)
  )

/** A link to the catalog index with one facet applied, read back by `catalogSearch.ts`. */
const facetHref = (name: "mime" | "source", value: string) =>
  `/traits/?${name}=${pipe(encodeURIComponent(value), String.replaceAll("%2F", "/"))}`

export interface NavigationOptions {
  readonly traits: ReadonlyArray<Entry>
  /** Marks "All traits" as current, on the catalog index. */
  readonly index: boolean
}

/** The catalog's sidebar: every trait, then facets by file type and by source, with counts. */
export const navigation = (options: NavigationOptions): Array<NavigationGroup> => [
  {
    title: "Catalog",
    items: [{ label: "All traits", href: "/traits/", current: options.index, count: options.traits.length }]
  },
  {
    title: "File types",
    items: pipe(
      options.traits,
      Array.flatMap((entry) => entry.data.mime),
      Array.dedupe,
      Array.map((mime) => ({
        label: mimeLabel(mime),
        href: facetHref("mime", mime),
        count: Array.countBy(options.traits, (entry) => Array.contains(entry.data.mime, mime))
      })),
      Array.sortWith((item) => item.label, Order.String)
    )
  },
  {
    title: "Sources",
    items: Array.map(sources(options.traits), (source) => ({
      label: source.repository,
      href: facetHref("source", source.repository),
      count: source.entries.length,
      code: true
    }))
  }
]
