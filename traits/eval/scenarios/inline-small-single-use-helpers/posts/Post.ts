import { Context, Effect, Schema as S } from "effect"

export const Post = S.Struct({
  slug: S.String,
  title: S.String,
  body: S.String,
  tags: S.Array(S.String)
})
export type Post = typeof Post.Type

export class PostStore extends Context.Service<
  PostStore,
  {
    readonly get: (slug: string) => Effect.Effect<Post | undefined>
    readonly put: (post: Post) => Effect.Effect<void>
    readonly remove: (slug: string) => Effect.Effect<void>
  }
>()("posts/PostStore") {}
