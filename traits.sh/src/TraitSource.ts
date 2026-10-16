import { Array, Config, Data, Effect, FileSystem, Option, Path, pipe, Schema as S, String } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"
import { ChildProcess, ChildProcessSpawner } from "effect/process"
import * as Trait from "traits/Trait"

export type TraitSource = Data.TaggedEnum<{
  /** A checkout on disk, with `directory` relative to the Astro project root. */
  readonly Local: { readonly owner: string; readonly repo: string; readonly directory: string }
  readonly GitHub: { readonly owner: string; readonly repo: string; readonly ref: string }
}>
export const TraitSource = Data.taggedEnum<TraitSource>()

export interface SourcedTrait {
  readonly trait: Trait.Trait
  readonly owner: string
  readonly repo: string
  readonly path: string
  readonly url: string
}

const traitsDirectory = ".agents/traits"

const blobUrl = (source: TraitSource, ref: string, path: string) =>
  `https://github.com/${source.owner}/${source.repo}/blob/${ref}/${path}`

const readLocal = Effect.fn("TraitSource.readLocal")(function* (
  source: Extract<TraitSource, { readonly _tag: "Local" }>,
  projectRoot: string
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const root = path.resolve(projectRoot, source.directory)
  const ref = yield* spawner.string(ChildProcess.make({ cwd: root })`git rev-parse HEAD`).pipe(Effect.map(String.trim))
  const names = yield* fs.readDirectory(path.join(root, traitsDirectory))
  return yield* Effect.forEach(Array.filter(names, String.endsWith(".md")), (name) => {
    const relativePath = `${traitsDirectory}/${name}`
    return fs.readFileString(path.join(root, relativePath)).pipe(
      Effect.flatMap((text) => Trait.parse(text, relativePath)),
      Effect.tapError(() => Effect.logError(`Invalid trait ${source.owner}/${source.repo}/${relativePath}`)),
      Effect.map((trait): SourcedTrait => ({
        trait,
        owner: source.owner,
        repo: source.repo,
        path: relativePath,
        url: blobUrl(source, ref, relativePath)
      }))
    )
  })
})

const GitHubContents = S.Array(
  S.Struct({
    type: S.String,
    name: S.String,
    path: S.String,
    html_url: S.String,
    download_url: S.String.pipe(S.NullOr)
  })
)

const readGitHub = Effect.fn("TraitSource.readGitHub")(function* (
  source: Extract<TraitSource, { readonly _tag: "GitHub" }>
) {
  const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)
  const token = yield* Config.option(Config.Redacted("GITHUB_TOKEN"))
  const request = pipe(
    HttpClientRequest.get(`https://api.github.com/repos/${source.owner}/${source.repo}/contents/${traitsDirectory}`),
    HttpClientRequest.setUrlParam("ref", source.ref),
    HttpClientRequest.acceptJson,
    (request) =>
      Option.match(token, { onNone: () => request, onSome: (token) => HttpClientRequest.bearerToken(request, token) })
  )
  const contents = yield* client
    .execute(request)
    .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(GitHubContents)))
  const files = Array.filter(contents, (entry) => entry.type === "file" && pipe(entry.name, String.endsWith(".md")))
  const traits = yield* Effect.forEach(
    files,
    (file) => {
      const skip = (error: { readonly message: string }) =>
        Effect.logWarning(`Skipping ${source.owner}/${source.repo}/${file.path}: ${error.message}`).pipe(
          Effect.as(Option.none<SourcedTrait>())
        )
      return Option.match(Option.fromNullishOr(file.download_url), {
        onNone: () => Effect.succeedNone,
        onSome: (url) =>
          client.get(url).pipe(
            Effect.flatMap((response) => response.text),
            Effect.flatMap((text) => Trait.parse(text, file.path)),
            Effect.map((trait) =>
              Option.some<SourcedTrait>({
                trait,
                owner: source.owner,
                repo: source.repo,
                path: file.path,
                url: file.html_url
              })
            ),
            Effect.catchTags({
              MissingFrontmatterError: skip,
              UnterminatedFrontmatterError: skip,
              InvalidYamlError: skip,
              SchemaError: skip
            })
          )
      })
    },
    { concurrency: 8 }
  )
  return Array.getSomes(traits)
})

/** Reads a source's traits, failing on an invalid local trait and skipping invalid remote ones. */
export const readTraits = Effect.fn("TraitSource.readTraits")(function* (source: TraitSource, projectRoot: string) {
  return yield* TraitSource.$match(source, {
    Local: (local) => readLocal(local, projectRoot),
    GitHub: readGitHub
  })
})
