import { NodeServices } from "@effect/platform-node"
import type { Loader, LoaderContext } from "astro/loaders"
import { Array, Effect, Layer, Logger, Path } from "effect"
import { FetchHttpClient } from "effect/http"

import * as TraitSource from "./TraitSource.ts"

const astroLogger = (logger: LoaderContext["logger"]) =>
  Logger.make((options) => {
    const text = Array.join(Array.map(Array.ensure(options.message), String), " ")
    if (options.logLevel === "Error" || options.logLevel === "Fatal") logger.error(text)
    else if (options.logLevel === "Warn") logger.warn(text)
    else logger.info(text)
  })

const storeTrait = Effect.fn("traitsLoader.storeTrait")(function* (
  context: LoaderContext,
  sourced: TraitSource.SourcedTrait
) {
  const { trait } = sourced
  const id = `${sourced.owner}/${sourced.repo}/${trait.id}`
  const data = yield* Effect.promise(() =>
    context.parseData({
      id,
      data: {
        traitId: trait.id,
        name: trait.name,
        when: trait.when,
        skip: trait.skip,
        mime: trait.mime === undefined ? [] : Array.ensure(trait.mime),
        owner: sourced.owner,
        repo: sourced.repo,
        path: sourced.path,
        url: sourced.url
      }
    })
  )
  const rendered = yield* Effect.promise(() => context.renderMarkdown(trait.body))
  context.store.set({
    id,
    data,
    body: trait.body,
    rendered,
    digest: context.generateDigest({ data, body: trait.body })
  })
})

export const traitsLoader = (sources: ReadonlyArray<TraitSource.TraitSource>): Loader => ({
  name: "traits",
  load: (context) =>
    Effect.gen(function* () {
      const path = yield* Path.Path
      const projectRoot = yield* path.fromFileUrl(context.config.root)
      const read = (source: TraitSource.TraitSource) => TraitSource.readTraits(source, projectRoot)
      const traits = yield* Effect.forEach(sources, read, { concurrency: "unbounded" })
      context.store.clear()
      yield* Effect.forEach(Array.flatten(traits), (sourced) => storeTrait(context, sourced))
      context.logger.info(`Loaded ${context.store.keys().length} traits`)
    }).pipe(
      Effect.provide(
        Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer, Logger.layer([astroLogger(context.logger)]))
      ),
      Effect.runPromise
    )
})
