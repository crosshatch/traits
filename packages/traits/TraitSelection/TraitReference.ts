import { Array, Schema as S, SchemaTransformation, String } from "effect"

import { TraitName } from "../Trait/TraitName.ts"
import { TraitSourceId } from "../TraitCollection/TraitSourceId.ts"

/** A reference to a trait, written as the path of its file under traits/ without the extension: its name alone for one of the workspace's own traits, such as my-trait, or the ID of its source and its name for a trait from a declared source, such as effect/my-trait. */
export type TraitReference = typeof TraitReference.Type
export const TraitReference = S.String.annotate({
  description:
    "A reference to a trait, written as the path of its file under traits/ without the extension: its name alone for one of the workspace's own traits, such as my-trait, or the ID of its source and its name for a trait from a declared source, such as effect/my-trait."
}).pipe(
  S.decodeTo(
    S.Struct({
      /** The ID of the declared source the trait comes from; omitted for one of the workspace's own traits. */
      source: TraitSourceId.annotateKey({
        description:
          "The ID of the declared source the trait comes from; omitted for one of the workspace's own traits."
      }).pipe(S.optionalKey),
      /** The trait's name within its source, or among the workspace's own traits. */
      name: TraitName.annotateKey({
        description: "The trait's name within its source, or among the workspace's own traits."
      })
    }),
    SchemaTransformation.transform({
      // Neither part may contain a slash, so the first one separates them, and any further one is left in the name to be rejected.
      decode: (reference) => {
        const [first, ...rest] = String.split(reference, "/")
        return Array.isReadonlyArrayNonEmpty(rest) ? { source: first, name: Array.join(rest, "/") } : { name: first }
      },
      encode: ({ name, source }) => (source === undefined ? name : `${source}/${name}`)
    })
  )
)
