import { Array, Effect } from "effect"

import { PostStore } from "./Post.ts"
import { toSlug } from "./slug.ts"
import { normalizeTag } from "./tags.ts"

export const createPost = Effect.fn("posts.createPost")(function* (input: {
  readonly title: string
  readonly body: string
  readonly tags: ReadonlyArray<string>
}) {
  const store = yield* PostStore
  const post = {
    slug: toSlug(input.title),
    title: input.title,
    body: input.body,
    tags: Array.dedupe(Array.map(input.tags, normalizeTag))
  }
  yield* store.put(post)
  return post
})
