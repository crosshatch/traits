import { Effect, Layer, Path, pipe, Schema as S } from "effect"

/** A module whose default export is an Effect Layer. */
export type LayerModule = typeof LayerModule.Type
export const LayerModule = S.Struct({
  default: S.declare<Layer.Any>(Layer.isLayer)
}).annotate({
  description: "A module whose default export is an Effect Layer."
})

export class LayerModuleLoadError extends S.TaggedError<LayerModuleLoadError>()("LayerModuleLoadError", {
  path: S.String,
  cause: S.Defect().pipe(S.optional)
}) {
  override get message() {
    return `Could not load a layer module from ${this.path}. The module must have an Effect Layer as its default export.`
  }
}

/** Imports a module's default Layer without building it or validating its provided services. */
export const load = Effect.fn("LayerModule.load")(function* (filename: string) {
  const path = yield* Path.Path
  const url = yield* path
    .toFileUrl(path.resolve(filename))
    .pipe(Effect.mapError((cause) => LayerModuleLoadError.make({ path: filename, cause })))
  const module = yield* Effect.tryPromise({
    try: (): Promise<unknown> => import(url.href),
    catch: (cause) => LayerModuleLoadError.make({ path: filename, cause })
  })
  return yield* pipe(
    module,
    S.decodeUnknownEffect(LayerModule),
    Effect.mapBoth({
      onSuccess: (module) => module.default,
      onFailure: () => LayerModuleLoadError.make({ path: filename })
    })
  )
})
