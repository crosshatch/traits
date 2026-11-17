import { Effect } from "effect"

import { PostStore } from "./Post.ts"
import { toSlug } from "./slug.ts"

export const renamePost = Effect.fn("posts.renamePost")(function* (slug: string, title: string) {
  const store = yield* PostStore
  const post = yield* store.get(slug)
  if (post === undefined) {
    return yield* Effect.die(`No post has the slug ${slug}.`)
  }
  const renamed = { ...post, title, slug: toSlug(title) }
  yield* store.remove(slug)
  yield* store.put(renamed)
  return renamed
})
