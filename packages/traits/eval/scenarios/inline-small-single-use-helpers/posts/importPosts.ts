import { Effect, Schema as S } from "effect"

import { Post, PostStore } from "./Post.ts"
import { toSlug } from "./slug.ts"

export const importPosts = Effect.fn("posts.importPosts")(function* (json: string) {
  const store = yield* PostStore
  const posts = yield* S.decodeUnknownEffect(S.fromJsonString(S.Array(Post)))(json)
  yield* Effect.forEach(posts, (post) => store.put({ ...post, slug: toSlug(post.title) }), { discard: true })
  return posts.length
})
