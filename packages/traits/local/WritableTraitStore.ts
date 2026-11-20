import { CredentialsFromEnv } from "@distilled.cloud/github/Credentials"
import { GithubProtocol } from "@distilled.cloud/github/Protocol"
import { Array, Context, Effect, FileSystem, Layer, pipe, Record, Schema as S, Semaphore } from "effect"

import type { EnvironmentName } from "../EnvironmentName.ts"
import * as Ingest from "../ingest.ts"
import * as TraitFile from "../TraitFile.ts"
import type { TraitName } from "../TraitName.ts"
import { TraitsEnvironment } from "../TraitsEnvironment.ts"
import { digestText } from "../util/TextDigest.ts"
import * as Metadata from "./IngestionMetadata.ts"
import * as Source from "./IngestionSource.ts"
import * as TraitsConfig from "./TraitsConfig.ts"
import * as Environments from "./WorkspaceEnvironments.ts"
import * as Layout from "./WorkspaceLayout.ts"
import * as WorkspaceModels from "./WorkspaceModels.ts"
import { WorkspaceRoot } from "./WorkspaceRoot.ts"

export interface AddOptions {
  readonly environment?: EnvironmentName | undefined
  readonly track?: boolean | undefined
  readonly deep?: boolean | undefined
  readonly force?: boolean | undefined
}
export interface PullOptions {
  readonly environments?: ReadonlyArray<EnvironmentName> | undefined
  readonly force?: boolean | undefined
}
/** An ingestion conflict needs user action. */
export class IngestionError extends S.TaggedError<IngestionError>()("IngestionError", {
  /** Affected trait/source and the action needed to continue. */
  message: S.String.annotateKey({ description: "Affected trait/source and the action needed to continue." })
}) {}

/** Local edits need an explicit overwrite decision from the calling client. */
export class LocalTraitEdits extends S.TaggedError<LocalTraitEdits>()("LocalTraitEdits", {
  /** Source whose import would replace or remove local edits. */
  source: S.String.annotateKey({ description: "Source whose import would replace or remove local edits." }),
  /** Workspace-relative trait files requiring review before a forced import. */
  paths: S.NonEmptyArray(S.String).annotateKey({
    description: "Workspace-relative trait files requiring review before a forced import."
  })
}) {
  override get message(): string {
    return `Local edits in ${Array.join(this.paths, ", ")} would be overwritten by ${this.source}. Review them and retry with --force only if you want to replace them. No files from this source were changed.`
  }
}

/** Computes an entire source's replacement before writing any trait files. */
const ingestSource = Effect.fn("WritableTraitStore.ingestSource")(function* (
  source: string,
  options: AddOptions,
  metadata: { readonly remotes: Record<string, Metadata.Remote> },
  previous?: Metadata.Remote,
  force: boolean = false
) {
  const fs = yield* FileSystem.FileSystem
  const { directory } = yield* WorkspaceRoot
  const content: Source.SourceContent = yield* Source.load(source, options.deep, previous?.branch)
  const contentHash = yield* digestText(JSON.stringify(content.files))
  const files: Record<string, Metadata.Remote["files"][string]> = {}
  const documents = new Map<TraitName, string>()
  const retained = new Set<TraitName>()
  for (const file of content.files) {
    const digest = yield* digestText(file.text)
    const cached = previous?.files[file.path]
    if (cached?.hash === digest && previous?.ref === content.ref) {
      files[file.path] = cached
      for (const name of cached.traits) {
        if (documents.has(name) || retained.has(name)) {
          return yield* IngestionError.make({ message: `Duplicate ingested trait: ${name}` })
        }
        retained.add(name)
      }
      continue
    }
    const parsed = yield* Ingest.parseOrExtract(file.path, file.text)
    files[file.path] = {
      hash: digest,
      extracted: parsed.extracted,
      traits: Array.map(parsed.traits, (trait) => trait.name)
    }
    for (const trait of parsed.traits) {
      if (documents.has(trait.name) || retained.has(trait.name)) {
        return yield* IngestionError.make({ message: `Duplicate ingested trait: ${trait.name}` })
      }
      documents.set(trait.name, TraitFile.serialize(trait))
    }
  }
  const deleted = Array.filter(
    Record.keys(previous?.installed ?? {}),
    (name) => !documents.has(name) && !retained.has(name)
  )
  const conflicts: Array<string> = []
  for (const name of [...documents.keys(), ...deleted]) {
    for (const [other, remote] of Record.toEntries(metadata.remotes)) {
      if (other !== source && name in remote.installed) {
        return yield* IngestionError.make({ message: `${name} is already owned by tracked source ${other}.` })
      }
    }
    const file = `${directory}/${Layout.traitFile(name)}`
    if (!(yield* fs.exists(file))) {
      continue
    }
    const text = yield* fs.readFileString(file)
    if (text === documents.get(name)) {
      continue
    }
    const digest = yield* digestText(text)
    if (previous?.installed[name] !== digest && !force) {
      conflicts.push(Layout.traitFile(name))
    }
  }
  if (Array.isArrayNonEmpty(conflicts)) {
    return yield* LocalTraitEdits.make({ source, paths: conflicts })
  }
  // Validate an existing environment before changing any traits.
  const { environment } = options
  const environmentFile = environment === undefined ? undefined : `${directory}/${Layout.environmentFile(environment)}`
  const environmentExists = environmentFile !== undefined && (yield* fs.exists(environmentFile))
  const selected =
    environment === undefined
      ? undefined
      : environmentExists
        ? yield* Environments.load(environment)
        : TraitsEnvironment.make({ traits: [] })
  yield* fs.makeDirectory(`${directory}/traits`, { recursive: true })
  const installed = { ...previous?.installed }
  const changed = yield* Effect.forEach(
    documents,
    Effect.fn("WritableTraitStore.install")(function* ([name, text]) {
      const file = `${directory}/${Layout.traitFile(name)}`
      const current = (yield* fs.exists(file)) ? yield* fs.readFileString(file) : undefined
      if (current !== text) {
        yield* fs.writeFileString(file, text)
      }
      installed[name] = yield* digestText(text)
      return current !== text ? [name] : []
    }),
    { concurrency: 1 }
  ).pipe(Effect.map(Array.flatten))
  for (const name of deleted) {
    yield* fs.remove(`${directory}/${Layout.traitFile(name)}`, { force: true })
    delete installed[name]
  }
  if (selected !== undefined && environmentFile !== undefined) {
    const traits = [
      ...new Set([
        ...Array.filter(selected.traits, (name) => !Array.contains(deleted, name)),
        ...documents.keys(),
        ...retained
      ])
    ]
    yield* fs.makeDirectory(`${directory}/${Layout.environments}`, { recursive: true })
    const text = yield* pipe({ traits }, S.encodeEffect(S.fromJsonString(TraitsEnvironment)), Effect.orDie)
    yield* fs.writeFileString(environmentFile, text)
  }
  if (content.remote && (options.track || previous !== undefined)) {
    metadata.remotes[source] = {
      ...(content.ref === undefined ? {} : { ref: content.ref }),
      ...(content.branch === undefined ? {} : { branch: content.branch }),
      ...(environment === undefined ? {} : { environment }),
      hash: contentHash,
      deep: options.deep ?? false,
      extracted: Array.some(Record.values(files), (file) => file.extracted),
      files,
      installed
    }
    yield* Metadata.write(metadata)
  }
  return {
    traits: [...documents.keys(), ...retained],
    changed,
    removed: deleted,
    environmentsCreated: environment !== undefined && !environmentExists ? [environment] : []
  }
})

const add = Effect.fn("WritableTraitStore.add")(function* (source: string, options: AddOptions = {}) {
  const metadata = yield* Metadata.read
  return yield* ingestSource(source, options, metadata, metadata.remotes[source], options.force)
})

const pull = Effect.fn("WritableTraitStore.pull")(function* (options: PullOptions = {}) {
  const metadata = yield* Metadata.read
  const groups = yield* Effect.forEach(
    Record.toEntries(metadata.remotes),
    Effect.fn("WritableTraitStore.pullSource")(function* ([source, previous]) {
      const selected =
        options.environments !== undefined && options.environments.length > 0
          ? previous.environment !== undefined && Array.contains(options.environments, previous.environment)
          : previous.environment === undefined
      if (!selected) {
        return { traits: [], changed: [], removed: [], environmentsCreated: [] }
      }
      return yield* ingestSource(
        source,
        { environment: previous.environment, deep: previous.deep, track: true },
        metadata,
        previous,
        options.force
      )
    }),
    { concurrency: 1 }
  )
  return {
    traits: pipe(
      groups,
      Array.flatMap((group) => group.traits),
      Array.dedupe
    ),
    changed: pipe(
      groups,
      Array.flatMap((group) => group.changed),
      Array.dedupe
    ),
    removed: pipe(
      groups,
      Array.flatMap((group) => group.removed),
      Array.dedupe
    ),
    environmentsCreated: pipe(
      groups,
      Array.flatMap((group) => group.environmentsCreated),
      Array.dedupe
    )
  }
})

/** Persists imported traits, environment membership, and source metadata; application is a separate operation. */
export class WritableTraitStore extends Context.Service<
  WritableTraitStore,
  {
    readonly add: (
      source: string,
      options?: AddOptions
    ) => Effect.Effect<Effect.Success<ReturnType<typeof add>>, Effect.Error<ReturnType<typeof add>>>
    readonly pull: (
      options?: PullOptions
    ) => Effect.Effect<Effect.Success<ReturnType<typeof pull>>, Effect.Error<ReturnType<typeof pull>>>
  }
>()("traits/local/WritableTraitStore") {}

/** Workspace-configured ingestion with the language model and GitHub transport. */
export const layer = TraitsConfig.load.pipe(
  Effect.map((config) =>
    Layer.effect(
      WritableTraitStore,
      Effect.gen(function* () {
        const services = yield* Effect.context<Effect.Services<ReturnType<typeof add>>>()
        const semaphore = yield* Semaphore.make(1)
        return {
          add: (source: string, options?: AddOptions) =>
            add(source, options).pipe(Effect.provideContext(services), (effect) => semaphore.withPermit(effect)),
          pull: (options?: PullOptions) =>
            pull(options).pipe(Effect.provideContext(services), (effect) => semaphore.withPermit(effect))
        }
      })
    ).pipe(Layer.provide(WorkspaceModels.layerLanguage(config)), Layer.provide([CredentialsFromEnv, GithubProtocol]))
  ),
  Layer.unwrap
)
