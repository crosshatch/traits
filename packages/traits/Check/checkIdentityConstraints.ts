import { Array, Schema as S } from "effect"

/** What a check request and its report must both keep unambiguous: a trait is identified by its name, and a change by its after path. */
export const checkIdentityConstraints = [
  S.makeFilter(
    (value: { readonly traits: ReadonlyArray<{ readonly trait: { readonly name: string } }> }) => {
      const names = Array.map(value.traits, (entry) => entry.trait.name)
      return Array.dedupe(names).length === names.length
    },
    { message: "Trait names must be unique." }
  ),
  S.makeFilter(
    (value: { readonly changes: ReadonlyArray<{ readonly after?: { readonly path: string } | undefined }> }) => {
      const afterPaths = Array.flatMap(value.changes, (change) =>
        change.after === undefined ? [] : [change.after.path]
      )
      return Array.dedupe(afterPaths).length === afterPaths.length
    },
    { message: "No two changes may share an after path." }
  )
] as const
