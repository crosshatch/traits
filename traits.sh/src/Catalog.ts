import type { CollectionEntry } from "astro:content"
import { Array, Order, pipe, Record } from "effect"

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
  /** Sets the title as a mono label, for identifiers such as repository slugs. */
  readonly code?: boolean | undefined
}

export const href = (entry: Entry) => `/traits/${entry.id}/`

/** Traits grouped by repository, both sorted by name. */
export const sources = (traits: ReadonlyArray<Entry>) =>
  pipe(
    traits,
    Array.sortWith((entry) => entry.data.name, Order.String),
    Array.groupBy((entry) => `${entry.data.owner}/${entry.data.repo}`),
    Record.toEntries,
    Array.sortWith(([repository]) => repository, Order.String)
  )

export interface NavigationOptions {
  readonly traits: ReadonlyArray<Entry>
  /** The entry whose page is showing, if any. */
  readonly current?: Entry | undefined
}

/** The catalog's sidebar. */
export const navigation = (options: NavigationOptions): Array<NavigationGroup> => [
  {
    title: "Catalog",
    items: [
      { label: "All traits", href: "/traits/", current: options.current === undefined, count: options.traits.length }
    ]
  },
  ...Array.map(sources(options.traits), ([repository, entries]) => ({
    title: repository,
    code: true,
    items: Array.map(entries, (entry) => ({
      label: entry.data.name,
      href: href(entry),
      current: entry.id === options.current?.id,
      code: true
    }))
  }))
]
